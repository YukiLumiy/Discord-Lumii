import { prisma } from "@lumii/database";
import type { LumiiClient } from "../../client.js";

/**
 * 登録済みの全チャンネルのRSSを確認する(10分ごとに scheduler から呼ばれる)。
 *
 * TODO:
 *  1. https://www.youtube.com/feeds/videos.xml?channel_id=<youtubeChannelId> を fetch して最新動画を取得
 *  2. lastVideoId が null の初回は、通知せず lastVideoId だけ保存する(過去動画の大量通知を防ぐ)
 *  3. lastVideoId と違う動画があれば discordChannelId にパネル(ComponentsV2)で通知し、lastVideoId を更新
 *  4. lastCheckedAt を更新
 */
export async function checkAllSubscriptions(_client: LumiiClient): Promise<void> {
  const subscriptions = await prisma.youtubeSubscription.findMany();
  if (subscriptions.length === 0) return;
  console.log(`[youtube] checking ${subscriptions.length} subscription(s)`);
}
