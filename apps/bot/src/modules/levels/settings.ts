import { prisma } from "@lumii/database";

export interface LevelConfig {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  cooldownSeconds: number;
  levelUpEnabled: boolean;
  levelUpChannelId: string | null;
  levelUpMessage: string;
  stackRoles: boolean;
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  enabled: true,
  xpMin: 15,
  xpMax: 25,
  cooldownSeconds: 60,
  levelUpEnabled: true,
  levelUpChannelId: null,
  levelUpMessage: "{user} reached level **{level}**!",
  stackRoles: false,
};

// メッセージごとにDBへ問い合わせると遅いので、設定は短時間キャッシュする(設定変更時は invalidate)
const TTL_MS = 30_000;
const settingsCache = new Map<string, { at: number; value: LevelConfig }>();
const noXpCache = new Map<string, { at: number; value: Set<string> }>();

export async function getLevelConfig(guildId: string): Promise<LevelConfig> {
  const hit = settingsCache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const row = await prisma.levelSettings.findUnique({ where: { guildId } });
  const value: LevelConfig = row
    ? {
        enabled: row.enabled,
        xpMin: row.xpMin,
        xpMax: row.xpMax,
        cooldownSeconds: row.cooldownSeconds,
        levelUpEnabled: row.levelUpEnabled,
        levelUpChannelId: row.levelUpChannelId,
        levelUpMessage: row.levelUpMessage,
        stackRoles: row.stackRoles,
      }
    : DEFAULT_LEVEL_CONFIG;
  settingsCache.set(guildId, { at: Date.now(), value });
  return value;
}

export async function getNoXpChannels(guildId: string): Promise<Set<string>> {
  const hit = noXpCache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const rows = await prisma.levelNoXpChannel.findMany({ where: { guildId } });
  const value = new Set<string>(rows.map((r: { channelId: string }) => r.channelId));
  noXpCache.set(guildId, { at: Date.now(), value });
  return value;
}

export function invalidateLevelCaches(guildId: string): void {
  settingsCache.delete(guildId);
  noXpCache.delete(guildId);
}
