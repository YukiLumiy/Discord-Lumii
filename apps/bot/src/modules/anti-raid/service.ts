import { GuildVerificationLevel, type Client, type Guild, type GuildMember } from "discord.js";
import { prisma } from "@lumii/database";
import { COLORS, panel, v2 } from "../../core/panel.js";
import { ACTION_LABELS, getAntiRaidConfig, type AntiRaidConfig } from "./config.js";

/**
 * Anti Raid
 *  1) 参加速度の監視: windowSeconds 以内に threshold 人以上が参加したらレイドと判定
 *  2) アカウント年齢: minAccountAgeDays より新しいアカウントは参加時にキック
 *  レイド判定後の処理(action):
 *    alert    ログのみ
 *    lockdown サーバーの認証レベルを最高(Very High)にして新規参加者の発言を制限。最後のレイド参加から
 *             lockdownMinutes 経つと元の認証レベルへ自動で戻す
 *    kick/ban 窓内に参加した全員 + 以降(レイド収束まで)の参加者を処罰
 */

interface JoinRecord {
  userId: string;
  at: number;
  handled: boolean;
}

interface Episode {
  startedAt: number;
  lastAt: number;
  lastLockdownExtendAt: number;
  action: AntiRaidConfig["action"];
  handled: Set<string>;
  tripWindow: number;
  tripCount: number;
}

const joins = new Map<string, JoinRecord[]>();
const episodes = new Map<string, Episode>();
const DAY_MS = 86_400_000;
const EPISODE_QUIET_MS = 60_000; // この時間、新しいレイド参加が無ければ収束とみなす
const MAX_TRACKED_JOINS = 1_000;

// ---------------------------------------------------------------- logging

async function sendSecurityLog(client: Client, channelId: string | null, container: ReturnType<typeof panel>) {
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isSendable()) return;
  await channel.send(v2(container)).catch((err) => console.error("[anti-raid] failed to send log", err));
}

const mentionList = (ids: string[], max = 10) =>
  ids.slice(0, max).map((id) => `<@${id}>`).join(", ") + (ids.length > max ? ` and ${ids.length - max} more` : "");

// ---------------------------------------------------------------- actions

async function removeMember(guild: Guild, userId: string, kind: "kick" | "ban", reason: string): Promise<boolean> {
  try {
    if (kind === "ban") await guild.bans.create(userId, { reason, deleteMessageSeconds: 0 });
    else await guild.members.kick(userId, reason);
    return true;
  } catch (err) {
    console.error(`[anti-raid] failed to ${kind} ${userId} in ${guild.id}`, err);
    return false;
  }
}

// ロックダウンの自動解除もタイマーで行う(DBを定期的に見に行かない)。24時間ずつ区切って待つ。
const unlockTimers = new Map<string, NodeJS.Timeout>();
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

function scheduleLockdownEnd(client: Client, guildId: string, until: Date): void {
  clearTimeout(unlockTimers.get(guildId));
  const remaining = until.getTime() - Date.now();
  const timer = setTimeout(() => {
    unlockTimers.delete(guildId);
    if (until.getTime() - Date.now() > 1_000) return scheduleLockdownEnd(client, guildId, until);
    endLockdown(client, guildId, "No new raid joins for the configured lockdown time.").catch((err) => console.error("[anti-raid] unlock failed", err));
  }, Math.min(Math.max(remaining, 0), MAX_TIMER_MS));
  unlockTimers.set(guildId, timer);
}

/** 起動時に1回だけDBを読み、ロックダウン中のサーバーの解除タイマーを張り直す。 */
export async function restoreLockdowns(client: Client): Promise<void> {
  const locked = await prisma.antiRaidSettings.findMany({ where: { lockdownUntil: { not: null } }, select: { guildId: true, lockdownUntil: true } });
  for (const row of locked as { guildId: string; lockdownUntil: Date }[]) scheduleLockdownEnd(client, row.guildId, row.lockdownUntil);
}

/** 認証レベルを Very High にする。すでにロックダウン中なら解除予定時刻だけ延長する。 */
async function applyLockdown(guild: Guild, minutes: number): Promise<void> {
  const row = await prisma.antiRaidSettings.findUnique({ where: { guildId: guild.id } });
  const alreadyLocked = Boolean(row?.lockdownUntil);
  const previous = alreadyLocked ? (row!.lockdownPreviousLevel ?? guild.verificationLevel) : guild.verificationLevel;

  if (!alreadyLocked && guild.verificationLevel !== GuildVerificationLevel.VeryHigh) {
    await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh, "Anti-raid lockdown").catch((err) => {
      console.error(`[anti-raid] failed to raise verification level in ${guild.id}`, err);
    });
  }

  const until = new Date(Date.now() + minutes * 60_000);
  const data = { lockdownUntil: until, lockdownPreviousLevel: previous };
  await prisma.antiRaidSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
  scheduleLockdownEnd(guild.client, guild.id, until);
}

/** ロックダウンを終了して認証レベルを元に戻す。ロックダウン中でなければ false。 */
export async function endLockdown(client: Client, guildId: string, reason: string): Promise<boolean> {
  clearTimeout(unlockTimers.get(guildId));
  unlockTimers.delete(guildId);
  const row = await prisma.antiRaidSettings.findUnique({ where: { guildId } });
  if (!row?.lockdownUntil) return false;

  // 先に状態を解除してから戻す(同時に2回解除されないように)
  const claimed = await prisma.antiRaidSettings.updateMany({
    where: { guildId, lockdownUntil: { not: null } },
    data: { lockdownUntil: null, lockdownPreviousLevel: null },
  });
  if (claimed.count === 0) return false;

  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  const previous = (row.lockdownPreviousLevel ?? GuildVerificationLevel.Low) as GuildVerificationLevel;
  if (guild && guild.verificationLevel !== previous) {
    await guild.setVerificationLevel(previous, "Anti-raid lockdown ended").catch((err) => {
      console.error(`[anti-raid] failed to restore verification level in ${guildId}`, err);
    });
  }

  await sendSecurityLog(
    client,
    row.logChannelId,
    panel({ title: "Lockdown ended", body: `The verification level was restored.\n> ${reason}`, color: COLORS.success }),
  );
  return true;
}

// ---------------------------------------------------------------- join handling

export async function handleJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const guild = member.guild;
  const config = await getAntiRaidConfig(guild.id);
  if (!config.enabled) return;

  const now = Date.now();
  const windowMs = config.joinWindowSeconds * 1000;
  const recent = (joins.get(guild.id) ?? []).filter((j) => now - j.at < windowMs).slice(-MAX_TRACKED_JOINS);
  const record: JoinRecord = { userId: member.id, at: now, handled: false };
  recent.push(record);
  joins.set(guild.id, recent);

  // 1) 新しすぎるアカウントはキック
  if (config.minAccountAgeDays > 0) {
    const ageDays = (now - member.user.createdTimestamp) / DAY_MS;
    if (ageDays < config.minAccountAgeDays) {
      record.handled = await removeMember(guild, member.id, "kick", `Anti-raid: account younger than ${config.minAccountAgeDays} days`);
      const episode = episodes.get(guild.id);
      if (record.handled) {
        episode?.handled.add(member.id);
        // レイド中は収束時にまとめて報告するので、個別のログは出さない
        if (!episode) {
          await sendSecurityLog(
            member.client,
            config.logChannelId,
            panel({
              title: "Young account removed",
              body: `<@${member.id}> was kicked.\n> Account age: **${ageDays.toFixed(1)}** days (minimum **${config.minAccountAgeDays}**)`,
              color: COLORS.danger,
            }),
          );
        }
      }
    }
  }

  // 2) 参加速度によるレイド判定
  const tripped = recent.length >= config.joinThreshold;
  let episode = episodes.get(guild.id);

  if (tripped && !episode) {
    // 同時に参加した人が二重にレイド判定しないよう、await より前に状態を登録する
    episode = {
      startedAt: now,
      lastAt: now,
      lastLockdownExtendAt: now,
      action: config.action,
      handled: new Set(recent.filter((j) => j.handled).map((j) => j.userId)),
      tripWindow: config.joinWindowSeconds,
      tripCount: recent.length,
    };
    episodes.set(guild.id, episode);

    const targets = recent.filter((j) => !j.handled);
    const ids = recent.map((j) => j.userId);
    await sendSecurityLog(
      member.client,
      config.logChannelId,
      panel({
        title: "Raid detected",
        body: [
          `**Joins:** ${recent.length} within ${config.joinWindowSeconds}s (threshold ${config.joinThreshold})`,
          `**Action:** ${ACTION_LABELS[config.action]}`,
          `**Accounts:** ${mentionList(ids)}`,
        ].join("\n"),
        color: COLORS.danger,
      }),
    );

    if (config.action === "lockdown") {
      await applyLockdown(guild, config.lockdownMinutes);
    } else if (config.action === "kick" || config.action === "ban") {
      for (const target of targets) {
        target.handled = await removeMember(guild, target.userId, config.action, "Anti-raid: rapid join detected");
        if (target.handled) episode.handled.add(target.userId);
      }
    }
    return;
  }

  if (episode) {
    episode.lastAt = now;
    if (episode.action === "lockdown") {
      // ロックダウンの解除時刻を、最後のレイド参加から lockdownMinutes 後に延長する(30秒に1回まで)
      if (now - episode.lastLockdownExtendAt > 30_000) {
        episode.lastLockdownExtendAt = now;
        await applyLockdown(guild, config.lockdownMinutes);
      }
    } else if ((episode.action === "kick" || episode.action === "ban") && !record.handled) {
      record.handled = await removeMember(guild, member.id, episode.action, "Anti-raid: raid in progress");
      if (record.handled) episode.handled.add(member.id);
    }
  }
}

// ---------------------------------------------------------------- periodic

/** 30秒ごと(メモリ上の状態だけを見る。DBは読まない): 収束したレイドの報告 */
export async function tick(client: Client): Promise<void> {
  const now = Date.now();

  for (const [guildId, episode] of episodes) {
    if (now - episode.lastAt < EPISODE_QUIET_MS) continue;
    episodes.delete(guildId);

    const config = await getAntiRaidConfig(guildId);
    const handled = [...episode.handled];
    await sendSecurityLog(
      client,
      config.logChannelId,
      panel({
        title: "Raid over",
        body: [
          `**Started:** <t:${Math.floor(episode.startedAt / 1000)}:R>`,
          `**Action:** ${ACTION_LABELS[episode.action]}`,
          episode.action === "kick" || episode.action === "ban" ? `**Removed:** ${handled.length} account${handled.length === 1 ? "" : "s"}` : null,
          handled.length > 0 ? `**Accounts:** ${mentionList(handled, 15)}` : null,
        ]
          .filter((l): l is string => l !== null)
          .join("\n"),
        color: COLORS.neutral,
      }),
    );
  }
}

// ---------------------------------------------------------------- helpers for the config command

export async function getLockdownUntil(guildId: string): Promise<Date | null> {
  const row = await prisma.antiRaidSettings.findUnique({ where: { guildId }, select: { lockdownUntil: true } });
  return row?.lockdownUntil ?? null;
}

