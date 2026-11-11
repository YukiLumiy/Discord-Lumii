import { prisma } from "@lumii/database";
import { createGuildCache } from "../../core/guild-cache.js";

export type LogCategory = "message" | "member" | "moderation" | "server" | "voice";

export const LOG_CATEGORIES: { key: LogCategory; label: string; description: string }[] = [
  { key: "message", label: "Messages", description: "Deleted and edited messages" },
  { key: "member", label: "Members", description: "Joins, leaves, nickname and role changes" },
  { key: "moderation", label: "Moderation", description: "Bans, unbans, kicks and timeouts" },
  { key: "server", label: "Server", description: "Channel, role and server setting changes" },
  { key: "voice", label: "Voice", description: "Voice channel joins, leaves and moves" },
];

export type LogChannels = Record<LogCategory, string | null>;

const EMPTY: LogChannels = { message: null, member: null, moderation: null, server: null, voice: null };

// ログはイベントのたびに出力先を調べるので、設定はキャッシュしてDBを引く回数を抑える
const cache = createGuildCache<LogChannels>(async (guildId) => {
  const row = await prisma.logSettings.findUnique({ where: { guildId } });
  if (!row) return EMPTY;
  return {
    message: row.messageChannelId,
    member: row.memberChannelId,
    moderation: row.moderationChannelId,
    server: row.serverChannelId,
    voice: row.voiceChannelId,
  };
});

export const getLogChannels = cache.get;
export const invalidateLogChannels = cache.invalidate;

/** DBの列名(カテゴリごと) */
export const COLUMN: Record<LogCategory, string> = {
  message: "messageChannelId",
  member: "memberChannelId",
  moderation: "moderationChannelId",
  server: "serverChannelId",
  voice: "voiceChannelId",
};
