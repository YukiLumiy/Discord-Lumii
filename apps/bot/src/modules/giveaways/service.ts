import { randomInt } from "node:crypto";
import type { Client, Guild } from "discord.js";
import { prisma } from "@lumii/database";
import { COLORS, panel, v2 } from "../../core/panel.js";
import { buildGiveawayPanel, buildWinnersPanel, type GiveawayView } from "./panels.js";

/** 重み付き抽選(同じ人は1回まで)。重み2の人は重み1の人の2倍当たりやすい。 */
export function pickWinners<T extends { userId: string; weight: number }>(entries: T[], count: number): T[] {
  const pool = [...entries];
  const winners: T[] = [];

  while (winners.length < count && pool.length > 0) {
    const total = pool.reduce((sum, e) => sum + Math.max(1, e.weight), 0);
    let roll = randomInt(total);
    let index = 0;
    for (; index < pool.length; index++) {
      roll -= Math.max(1, pool[index]!.weight);
      if (roll < 0) break;
    }
    winners.push(pool.splice(Math.min(index, pool.length - 1), 1)[0]!);
  }
  return winners;
}

/** サーバーに残っている参加者だけを返す(抽選後に退出した人は除く) */
async function filterPresent(guild: Guild, userIds: string[]): Promise<Set<string>> {
  const present = new Set<string>();
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const members = await guild.members.fetch({ user: chunk }).catch(() => null);
    members?.forEach((m) => present.add(m.id));
  }
  return present;
}

const messageUrl = (g: { guildId: string; channelId: string; messageId: string | null }) =>
  `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;

/** 開催中のパネルを最新の状態(参加人数・終了表示)に更新する。画像は元の添付が残る。 */
export async function refreshPanel(client: Client, giveawayId: string): Promise<void> {
  const g = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { _count: { select: { entries: true } } } });
  if (!g?.messageId) return;
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  await message?.edit(v2(buildGiveawayPanel(g as GiveawayView, g._count.entries))).catch(() => undefined);
}

/** 抽選を行って終了する。二重に終了しないよう、ended を条件付きで更新して先着1回だけ実行する。 */
export async function endGiveaway(client: Client, giveawayId: string): Promise<"ended" | "already_ended" | "not_found"> {
  const claimed = await prisma.giveaway.updateMany({ where: { id: giveawayId, ended: false, cancelled: false }, data: { ended: true } });
  if (claimed.count === 0) {
    const exists = await prisma.giveaway.findUnique({ where: { id: giveawayId }, select: { id: true } });
    return exists ? "already_ended" : "not_found";
  }

  const g = await prisma.giveaway.findUniqueOrThrow({ where: { id: giveawayId }, include: { entries: true } });
  const guild = client.guilds.cache.get(g.guildId) ?? (await client.guilds.fetch(g.guildId).catch(() => null));

  const present = guild ? await filterPresent(guild, g.entries.map((e: { userId: string }) => e.userId)) : new Set<string>();
  const eligible = g.entries.filter((e: { userId: string }) => present.has(e.userId));
  const winners = pickWinners(eligible, g.winnerCount);
  const winnerIds = winners.map((w) => w.userId);

  await prisma.giveaway.update({ where: { id: g.id }, data: { winnerIds } });
  const view = { ...g, ended: true, winnerIds } as GiveawayView;

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (channel?.isTextBased() && g.messageId) {
    const message = await channel.messages.fetch(g.messageId).catch(() => null);
    await message?.edit(v2(buildGiveawayPanel(view, g.entries.length))).catch(() => undefined);

    if (channel.isSendable()) {
      if (winnerIds.length > 0) {
        await channel
          .send({
            ...v2(buildWinnersPanel({ prize: g.prize, winnerIds, url: messageUrl(g) })),
            allowedMentions: { users: winnerIds, roles: g.pingRoleId ? [g.pingRoleId] : [] },
          })
          .catch(() => undefined);
      } else {
        await channel
          .send(v2(panel({ title: "Giveaway ended", body: `**Prize:** ${g.prize}\n\nNo valid entries, so no winner was drawn. [View the giveaway](${messageUrl(g)})`, color: COLORS.neutral })))
          .catch(() => undefined);
      }
    }
  }

  await grantWinnerRole(guild, g.winnersRoleId, winnerIds);
  return "ended";
}

async function grantWinnerRole(guild: Guild | null, roleId: string | null, winnerIds: string[]): Promise<void> {
  if (!guild || !roleId) return;
  for (const id of winnerIds) {
    const member = await guild.members.fetch(id).catch(() => null);
    await member?.roles.add(roleId).catch((err) => console.error(`[giveaways] failed to give winner role to ${id}`, err));
  }
}

/** 抽選を中止する(当選者は出さない)。 */
export async function cancelGiveaway(client: Client, giveawayId: string): Promise<boolean> {
  const claimed = await prisma.giveaway.updateMany({ where: { id: giveawayId, ended: false, cancelled: false }, data: { cancelled: true } });
  if (claimed.count === 0) return false;
  await refreshPanel(client, giveawayId);
  return true;
}

/** 終了済みの抽選から、まだ当選していない人の中から追加で当選者を引く。 */
export async function rerollGiveaway(client: Client, giveawayId: string, count: number): Promise<{ ok: true; winnerIds: string[] } | { ok: false; reason: string }> {
  const g = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { entries: true } });
  if (!g) return { ok: false, reason: "Giveaway not found." };
  if (!g.ended || g.cancelled) return { ok: false, reason: "That giveaway hasn't ended yet." };

  const guild = client.guilds.cache.get(g.guildId) ?? (await client.guilds.fetch(g.guildId).catch(() => null));
  const present = guild ? await filterPresent(guild, g.entries.map((e: { userId: string }) => e.userId)) : new Set<string>();
  const pool = g.entries.filter((e: { userId: string }) => present.has(e.userId) && !g.winnerIds.includes(e.userId));
  const winners = pickWinners(pool, count);
  if (winners.length === 0) return { ok: false, reason: "There are no other valid entrants left to draw from." };

  const newIds = winners.map((w) => w.userId);
  await prisma.giveaway.update({ where: { id: g.id }, data: { winnerIds: [...g.winnerIds, ...newIds] } });
  await refreshPanel(client, g.id);

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel
      .send({ ...v2(buildWinnersPanel({ prize: g.prize, winnerIds: newIds, url: messageUrl(g), reroll: true })), allowedMentions: { users: newIds } })
      .catch(() => undefined);
  }
  await grantWinnerRole(guild, g.winnersRoleId, newIds);
  return { ok: true, winnerIds: newIds };
}

/** 終了時刻を過ぎた抽選をまとめて終了する(15秒ごとにschedulerから呼ばれる)。再起動後も取りこぼさない。 */
export async function endDueGiveaways(client: Client): Promise<void> {
  const due = await prisma.giveaway.findMany({ where: { ended: false, cancelled: false, endsAt: { lte: new Date() } }, select: { id: true } });
  for (const { id } of due as { id: string }[]) {
    await endGiveaway(client, id).catch((err) => console.error(`[giveaways] failed to end ${id}`, err));
  }
}

