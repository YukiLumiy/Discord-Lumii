import type { Guild } from "discord.js";

/** Botがそのロールを付与できるか(Bot専用ロールでない & Botの最上位ロールより下)。 */
export function canBotAssignRole(guild: Guild, roleId: string): boolean {
  const role = guild.roles.cache.get(roleId);
  const botTop = guild.members.me?.roles.highest;
  if (!role || role.managed || role.id === guild.id || !botTop) return false;
  return role.comparePositionTo(botTop) < 0;
}

export const ROLE_HIERARCHY_HINT =
  "I can't assign that role right now. Move my role above it in **Server Settings → Roles** (and avoid integration-managed roles).";
