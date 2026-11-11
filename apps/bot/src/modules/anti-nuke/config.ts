import { prisma } from "@lumii/database";
import { createGuildCache } from "../../core/guild-cache.js";

export type NukePunishment = "removeRoles" | "kick" | "ban";
export type NukeKind = "channel" | "role" | "ban" | "kick";

export interface AntiNukeConfig {
  enabled: boolean;
  limits: Record<NukeKind, number>;
  windowSeconds: number;
  punishment: NukePunishment;
  whitelistedUserIds: string[];
  whitelistedRoleIds: string[];
  logChannelId: string | null;
}

export const DEFAULT_ANTI_NUKE_CONFIG: AntiNukeConfig = {
  enabled: false,
  limits: { channel: 3, role: 3, ban: 5, kick: 5 },
  windowSeconds: 30,
  punishment: "removeRoles",
  whitelistedUserIds: [],
  whitelistedRoleIds: [],
  logChannelId: null,
};

const cache = createGuildCache<AntiNukeConfig>(async (guildId) => {
  const row = await prisma.antiNukeSettings.findUnique({ where: { guildId } });
  if (!row) return DEFAULT_ANTI_NUKE_CONFIG;
  return {
    enabled: row.enabled,
    limits: { channel: row.maxChannelDeletes, role: row.maxRoleDeletes, ban: row.maxBans, kick: row.maxKicks },
    windowSeconds: row.windowSeconds,
    punishment: row.punishment as NukePunishment,
    whitelistedUserIds: row.whitelistedUserIds,
    whitelistedRoleIds: row.whitelistedRoleIds,
    logChannelId: row.logChannelId,
  };
});

export const getAntiNukeConfig = cache.get;
export const invalidateAntiNukeConfig = cache.invalidate;

export const KIND_LABELS: Record<NukeKind, string> = {
  channel: "channel deletions",
  role: "role deletions",
  ban: "bans",
  kick: "kicks",
};

export const PUNISHMENT_LABELS: Record<NukePunishment, string> = {
  removeRoles: "Remove all of their roles",
  kick: "Kick them",
  ban: "Ban them",
};
