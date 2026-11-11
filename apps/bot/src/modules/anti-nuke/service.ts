import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from "discord.js";
import { COLORS, panel, v2 } from "../../core/panel.js";
import { KIND_LABELS, PUNISHMENT_LABELS, getAntiNukeConfig, type AntiNukeConfig, type NukeKind } from "./config.js";

/**
 * Anti Nuke - サーバーを破壊する操作(チャンネル削除・ロール削除・大量BAN・大量キック)を
 * 短時間に繰り返したユーザーを自動で処罰する。
 *
 * 実行者は「監査ログに新しいエントリが作られた」イベントから直接取得する(1操作ごとに監査ログを
 * 検索しにいかないので、数十件の連続削除でもAPIの制限にかかりにくい)。
 * 回数はメモリ上で数え、DBには設定だけを保存する。
 */

/** 監査ログの種類 → 数える対象 */
export const TRACKED_ACTIONS: Partial<Record<AuditLogEvent, NukeKind>> = {
  [AuditLogEvent.ChannelDelete]: "channel",
  [AuditLogEvent.RoleDelete]: "role",
  [AuditLogEvent.MemberBanAdd]: "ban",
  [AuditLogEvent.MemberKick]: "kick",
};

const counters = new Map<string, number[]>(); // guildId:executorId:kind -> 操作時刻
const recentlyPunished = new Map<string, number>(); // guildId:executorId -> 処罰した時刻
const PUNISHED_MEMORY_MS = 60_000; // 処罰直後に流れてくる残りのイベントを無視する時間

const REASON = "Lumii Anti Nuke: destructive actions exceeded the limit";

export async function handleAuditLogEntry(entry: GuildAuditLogsEntry, guild: Guild): Promise<void> {
  const kind = TRACKED_ACTIONS[entry.action];
  const executorId = entry.executorId;
  if (!kind || !executorId) return;

  // サーバーオーナーとLumii自身は常に対象外
  if (executorId === guild.ownerId || executorId === guild.client.user?.id) return;

  const config = await getAntiNukeConfig(guild.id);
  if (!config.enabled || config.whitelistedUserIds.includes(executorId)) return;

  const punishedKey = `${guild.id}:${executorId}`;
  const punishedAt = recentlyPunished.get(punishedKey);
  if (punishedAt && Date.now() - punishedAt < PUNISHED_MEMORY_MS) return;

  const now = Date.now();
  const key = `${guild.id}:${executorId}:${kind}`;
  const times = (counters.get(key) ?? []).filter((t) => now - t < config.windowSeconds * 1000);
  times.push(now);
  counters.set(key, times);

  if (times.length < config.limits[kind]) return;

  // ここまで来たら発動(ホワイトリストのロール確認は、発動時だけメンバーを取得して行う)
  if (config.whitelistedRoleIds.length > 0) {
    const member = guild.members.cache.get(executorId) ?? (await guild.members.fetch(executorId).catch(() => null));
    if (member?.roles.cache.some((r) => config.whitelistedRoleIds.includes(r.id))) return;
  }

  // 並行して届く残りのイベントで二重に処罰しないよう、await より前に記録する
  recentlyPunished.set(punishedKey, now);
  for (const k of Object.keys(KIND_LABELS)) counters.delete(`${guild.id}:${executorId}:${k}`);

  const result = await punish(guild, executorId, config.punishment);
  await sendLog(guild, config, executorId, kind, times.length, result);
}

interface PunishResult {
  ok: boolean;
  /** 実際に行った内容、または失敗した理由 */
  detail: string;
}

async function punish(guild: Guild, executorId: string, punishment: AntiNukeConfig["punishment"]): Promise<PunishResult> {
  const member = guild.members.cache.get(executorId) ?? (await guild.members.fetch(executorId).catch(() => null));

  try {
    // すでにサーバーを抜けている実行者は、BANだけは名前を指定して実行できる
    if (!member) {
      if (punishment !== "ban") return { ok: false, detail: "They already left the server, so there was nothing to remove." };
      await guild.bans.create(executorId, { reason: REASON });
      return { ok: true, detail: "Banned (they had already left the server)." };
    }

    if (punishment === "ban") {
      if (!member.bannable) return { ok: false, detail: "I can't ban them: their highest role is not below mine, or I'm missing the Ban Members permission." };
      await member.ban({ reason: REASON });
      return { ok: true, detail: "Banned." };
    }

    // 他のBotはサーバー側で管理されたロールを外せないので、ロール剥奪ではなくキックにする
    if (punishment === "kick" || member.user.bot) {
      if (!member.kickable) return { ok: false, detail: "I can't kick them: their highest role is not below mine, or I'm missing the Kick Members permission." };
      await member.kick(REASON);
      return { ok: true, detail: member.user.bot && punishment === "removeRoles" ? "Kicked (bots' managed roles can't be removed)." : "Kicked." };
    }

    if (!member.manageable) return { ok: false, detail: "I can't change their roles: their highest role is not below mine, or I'm missing the Manage Roles permission." };
    const myTop = guild.members.me?.roles.highest;
    const removable = member.roles.cache.filter((r) => r.id !== guild.id && !r.managed && (!myTop || r.comparePositionTo(myTop) < 0));
    if (removable.size === 0) return { ok: false, detail: "They have no roles I can remove." };
    await member.roles.remove(removable, REASON);
    return { ok: true, detail: `Removed ${removable.size} role${removable.size === 1 ? "" : "s"}.` };
  } catch (err) {
    console.error(`[anti-nuke] punishment failed for ${executorId} in ${guild.id}`, err);
    return { ok: false, detail: "Discord rejected the action. Check my permissions and role position." };
  }
}

async function sendLog(guild: Guild, config: AntiNukeConfig, executorId: string, kind: NukeKind, count: number, result: PunishResult): Promise<void> {
  if (!config.logChannelId) return;
  const channel = await guild.client.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const body = [
    `<@${executorId}> performed **${count} ${KIND_LABELS[kind]}** within ${config.windowSeconds}s.`,
    `**Punishment:** ${PUNISHMENT_LABELS[config.punishment]}`,
    `**Result:** ${result.detail}`,
  ].join("\n");

  await channel
    .send(v2(panel({ title: result.ok ? "Anti Nuke triggered" : "Anti Nuke triggered, but the punishment failed", body, color: result.ok ? COLORS.danger : COLORS.neutral })))
    .catch((err) => console.error("[anti-nuke] failed to send log", err));
}

/** 古い記録がメモリに溜まり続けないよう、定期的に掃除する(DBには触れない) */
export function pruneOld(): void {
  const now = Date.now();
  for (const [key, times] of counters) {
    if (times.length === 0 || now - times[times.length - 1]! > 10 * 60_000) counters.delete(key);
  }
  for (const [key, at] of recentlyPunished) {
    if (now - at > PUNISHED_MEMORY_MS) recentlyPunished.delete(key);
  }
}
