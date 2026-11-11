import { prisma } from "@lumii/database";
import { createGuildCache } from "../../core/guild-cache.js";

export type HoneypotAction = "ban" | "softban" | "kick" | "timeout";

export interface HoneypotConfig {
  enabled: boolean;
  channelId: string | null;
  action: HoneypotAction;
  deleteMessageSeconds: number;
  ignoredRoleIds: string[];
  logChannelId: string | null;
}

export const DEFAULT_HONEYPOT_CONFIG: HoneypotConfig = {
  enabled: false,
  channelId: null,
  action: "ban",
  deleteMessageSeconds: 3600,
  ignoredRoleIds: [],
  logChannelId: null,
};

// 全メッセージで判定するので、設定はキャッシュして毎回DBを引かないようにする
const cache = createGuildCache<HoneypotConfig>(async (guildId) => {
  const row = await prisma.honeypotSettings.findUnique({ where: { guildId } });
  if (!row) return DEFAULT_HONEYPOT_CONFIG;
  return {
    enabled: row.enabled,
    channelId: row.channelId,
    action: row.action as HoneypotAction,
    deleteMessageSeconds: row.deleteMessageSeconds,
    ignoredRoleIds: row.ignoredRoleIds,
    logChannelId: row.logChannelId,
  };
});

export const getHoneypotConfig = cache.get;
export const invalidateHoneypotConfig = cache.invalidate;

export const ACTION_LABELS: Record<HoneypotAction, string> = {
  ban: "banned",
  softban: "removed (soft-banned) and their recent messages deleted",
  kick: "kicked",
  timeout: "timed out for 24 hours",
};

export const ACTION_CHOICES = [
  { name: "Ban (and delete their recent messages)", value: "ban" },
  { name: "Soft-ban (kick and delete their recent messages)", value: "softban" },
  { name: "Kick", value: "kick" },
  { name: "Timeout for 24 hours", value: "timeout" },
] as const;
