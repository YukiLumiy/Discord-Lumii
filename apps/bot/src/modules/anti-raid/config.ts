import { prisma } from "@lumii/database";

export type RaidAction = "alert" | "lockdown" | "kick" | "ban";

export interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: number;
  joinWindowSeconds: number;
  action: RaidAction;
  minAccountAgeDays: number;
  lockdownMinutes: number;
  logChannelId: string | null;
}

export const DEFAULT_ANTI_RAID_CONFIG: AntiRaidConfig = {
  enabled: false,
  joinThreshold: 10,
  joinWindowSeconds: 10,
  action: "lockdown",
  minAccountAgeDays: 0,
  lockdownMinutes: 10,
  logChannelId: null,
};

// 参加のたびにDBを引くとレイド中に重くなるので、設定は短時間キャッシュする(変更時は invalidate)
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: AntiRaidConfig }>();

export async function getAntiRaidConfig(guildId: string): Promise<AntiRaidConfig> {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const row = await prisma.antiRaidSettings.findUnique({ where: { guildId } });
  const value: AntiRaidConfig = row
    ? {
        enabled: row.enabled,
        joinThreshold: row.joinThreshold,
        joinWindowSeconds: row.joinWindowSeconds,
        action: row.action as RaidAction,
        minAccountAgeDays: row.minAccountAgeDays,
        lockdownMinutes: row.lockdownMinutes,
        logChannelId: row.logChannelId,
      }
    : DEFAULT_ANTI_RAID_CONFIG;
  cache.set(guildId, { at: Date.now(), value });
  return value;
}

export function invalidateAntiRaidConfig(guildId: string): void {
  cache.delete(guildId);
}

export const ACTION_LABELS: Record<RaidAction, string> = {
  alert: "Alert only (log, no action)",
  lockdown: "Lockdown (raise the verification level)",
  kick: "Kick the raiders",
  ban: "Ban the raiders",
};
