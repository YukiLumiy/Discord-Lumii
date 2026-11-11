import type { Client } from "discord.js";
import { prisma } from "@lumii/database";
import { text, v2 } from "../../core/panel.js";
import { FeedError, fetchFeed, type Feed } from "./feed.js";
import { buildVideoPanel } from "./panels.js";

/**
 * YouTube新着通知。
 * Neon無料枠の計算時間を節約するため、購読の一覧は起動時に1回だけDBから読み込んでメモリに保持する。
 * 10分ごとの確認ではDBを読まず、新しい動画を通知したときだけDBへ書き込む。
 */

export interface Subscription {
  id: string;
  guildId: string;
  youtubeChannelId: string;
  youtubeChannelName: string;
  discordChannelId: string;
  mentionRoleId: string | null;
  message: string | null;
  lastVideoId: string | null;
  lastPublishedAt: Date | null;
}

export const MAX_SUBSCRIPTIONS_PER_GUILD = 10;
const MAX_NOTIFICATIONS_PER_CHECK = 3; // 一度に大量の動画が見つかっても、通知は新しいものから最大3件まで

const subscriptions = new Map<string, Subscription>();
const failureCounts = new Map<string, number>();

// ---------------------------------------------------------------- store

export async function loadSubscriptions(): Promise<void> {
  const rows = await prisma.youtubeSubscription.findMany();
  subscriptions.clear();
  for (const r of rows as any[]) {
    subscriptions.set(r.id, {
      id: r.id,
      guildId: r.guildId,
      youtubeChannelId: r.youtubeChannelId,
      youtubeChannelName: r.youtubeChannelName ?? r.youtubeChannelId,
      discordChannelId: r.discordChannelId,
      mentionRoleId: r.mentionRoleId,
      message: r.message,
      lastVideoId: r.lastVideoId,
      lastPublishedAt: r.lastPublishedAt,
    });
  }
  console.log(`[youtube] loaded ${subscriptions.size} subscription(s)`);
}

export const listGuildSubscriptions = (guildId: string) => [...subscriptions.values()].filter((s) => s.guildId === guildId);

export type AddResult = { ok: true; subscription: Subscription } | { ok: false; reason: string };

export async function addSubscription(opts: {
  guildId: string;
  youtubeChannelId: string;
  discordChannelId: string;
  mentionRoleId: string | null;
  message: string | null;
}): Promise<AddResult> {
  const existing = listGuildSubscriptions(opts.guildId);
  if (existing.length >= MAX_SUBSCRIPTIONS_PER_GUILD) return { ok: false, reason: `This server already has the maximum of ${MAX_SUBSCRIPTIONS_PER_GUILD} YouTube channels.` };
  if (existing.some((s) => s.youtubeChannelId === opts.youtubeChannelId)) return { ok: false, reason: "That YouTube channel is already being tracked in this server." };

  let feed: Feed;
  try {
    feed = await fetchFeed(opts.youtubeChannelId);
  } catch (err) {
    return { ok: false, reason: err instanceof FeedError ? err.message : "I couldn't read that channel's feed." };
  }

  // 登録した時点での最新動画を「通知済み」として記録する(過去の動画を一気に通知しない)
  const newest = feed.videos[0] ?? null;
  const row = await prisma.youtubeSubscription.create({
    data: {
      guildId: opts.guildId,
      youtubeChannelId: opts.youtubeChannelId,
      youtubeChannelName: feed.channelName,
      discordChannelId: opts.discordChannelId,
      mentionRoleId: opts.mentionRoleId,
      message: opts.message,
      lastVideoId: newest?.id ?? null,
      lastPublishedAt: newest?.publishedAt ?? new Date(),
    },
  });

  const subscription: Subscription = {
    id: row.id,
    guildId: row.guildId,
    youtubeChannelId: row.youtubeChannelId,
    youtubeChannelName: feed.channelName,
    discordChannelId: row.discordChannelId,
    mentionRoleId: row.mentionRoleId,
    message: row.message,
    lastVideoId: row.lastVideoId,
    lastPublishedAt: row.lastPublishedAt,
  };
  subscriptions.set(subscription.id, subscription);
  return { ok: true, subscription };
}

export async function removeSubscription(guildId: string, id: string): Promise<Subscription | null> {
  const sub = subscriptions.get(id);
  if (!sub || sub.guildId !== guildId) return null;
  await prisma.youtubeSubscription.delete({ where: { id } });
  subscriptions.delete(id);
  return sub;
}

// ---------------------------------------------------------------- polling

/** 10分ごとに呼ばれる。同じYouTubeチャンネルを複数サーバーが登録していても、フィードは1回だけ取得する。 */
export async function checkAllSubscriptions(client: Client): Promise<void> {
  if (subscriptions.size === 0) return;

  const byChannel = new Map<string, Subscription[]>();
  for (const sub of subscriptions.values()) byChannel.set(sub.youtubeChannelId, [...(byChannel.get(sub.youtubeChannelId) ?? []), sub]);

  for (const [youtubeChannelId, subs] of byChannel) {
    let feed: Feed;
    try {
      feed = await fetchFeed(youtubeChannelId);
      failureCounts.delete(youtubeChannelId);
    } catch (err) {
      // 一時的な失敗は次回に再試行する。ログは連続失敗の1回目と、その後は1時間(6回)ごとにだけ出す。
      const count = (failureCounts.get(youtubeChannelId) ?? 0) + 1;
      failureCounts.set(youtubeChannelId, count);
      if (count === 1 || count % 6 === 0) console.warn(`[youtube] ${youtubeChannelId}: ${err instanceof Error ? err.message : err} (failures in a row: ${count})`);
      continue;
    }

    for (const sub of subs) await notifyNewVideos(client, sub, feed);
    await new Promise((r) => setTimeout(r, 300)); // YouTubeへのリクエストを少し間隔を空けて送る
  }
}

async function notifyNewVideos(client: Client, sub: Subscription, feed: Feed): Promise<void> {
  const newest = feed.videos[0];

  // 基準が無い(古いデータなど)場合は、通知せずに現在の最新を基準として記録する
  if (!sub.lastPublishedAt) {
    sub.lastPublishedAt = newest?.publishedAt ?? new Date();
    sub.lastVideoId = newest?.id ?? null;
    await persist(sub);
    return;
  }

  const lastTime = sub.lastPublishedAt.getTime();
  const fresh = feed.videos.filter((v) => v.publishedAt.getTime() > lastTime && v.id !== sub.lastVideoId).reverse(); // 古い順
  if (fresh.length === 0) return;

  const toSend = fresh.slice(-MAX_NOTIFICATIONS_PER_CHECK);
  const channel = await client.channels.fetch(sub.discordChannelId).catch(() => null);

  if (channel?.isSendable()) {
    for (const video of toSend) {
      const panel = buildVideoPanel({ channelName: feed.channelName, message: sub.message, video });
      const components = sub.mentionRoleId ? [text(`<@&${sub.mentionRoleId}>`), panel] : [panel];
      await channel
        .send({ ...v2(...components), allowedMentions: { roles: sub.mentionRoleId ? [sub.mentionRoleId] : [] } })
        .catch((err) => console.error(`[youtube] failed to post in ${sub.discordChannelId}`, err));
    }
  } else {
    console.warn(`[youtube] can't send to channel ${sub.discordChannelId} (guild ${sub.guildId}); skipping notification`);
  }

  // 送信できなかった場合も基準は進める(権限が戻ったときに古い動画をまとめて通知しないため)
  const latest = fresh[fresh.length - 1]!;
  sub.lastPublishedAt = latest.publishedAt;
  sub.lastVideoId = latest.id;
  sub.youtubeChannelName = feed.channelName;
  await persist(sub);
}

async function persist(sub: Subscription): Promise<void> {
  await prisma.youtubeSubscription
    .update({
      where: { id: sub.id },
      data: { lastVideoId: sub.lastVideoId, lastPublishedAt: sub.lastPublishedAt, youtubeChannelName: sub.youtubeChannelName, lastCheckedAt: new Date() },
    })
    .catch((err: unknown) => console.error(`[youtube] failed to save ${sub.id}`, err));
}
