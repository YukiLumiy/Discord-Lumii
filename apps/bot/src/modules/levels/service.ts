import type { Client } from "discord.js";
import { prisma } from "@lumii/database";
import { calculateLevel } from "./xp.js";
import { getLevelConfig } from "./settings.js";
import { sendLevelUpPanel } from "./panels.js";

/**
 * XPを付与し、レベルアップしていればロール付与と祝福パネルの送信まで行う。
 * 1回で複数レベル上がった場合もまとめて1回だけ通知する。
 */
export async function addXp(client: Client, guildId: string, userId: string, amount: number, fallbackChannelId?: string): Promise<void> {
  const row = await prisma.userLevel.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, xp: amount, messageCount: 1, lastXpAt: new Date() },
    update: { xp: { increment: amount }, messageCount: { increment: 1 }, lastXpAt: new Date() },
  });

  const newLevel = calculateLevel(row.xp).level;
  if (newLevel <= row.level) return;

  await prisma.userLevel.update({ where: { id: row.id }, data: { level: newLevel } });

  const config = await getLevelConfig(guildId);
  await applyRoleRewards(client, guildId, userId, newLevel, config.stackRoles);

  if (!config.levelUpEnabled) return;
  const channelId = config.levelUpChannelId ?? fallbackChannelId;
  if (!channelId) return;

  try {
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
    const user = await client.users.fetch(userId);
    await sendLevelUpPanel({ client, guildId, guildName: guild.name, channelId, user, oldLevel: row.level, newLevel, config });
  } catch (err) {
    console.error(`[levels] Failed to send level-up panel for ${userId}`, err);
  }
}

/**
 * レベルロールの付与。
 *  stackRoles = true : 到達済みのロールをすべて付与
 *  stackRoles = false: 到達済みの中で最高レベルのロールだけを残し、他のレベルロールは外す
 */
export async function applyRoleRewards(client: Client, guildId: string, userId: string, level: number, stackRoles: boolean): Promise<void> {
  const rewards = await prisma.levelRoleReward.findMany({ where: { guildId }, orderBy: { level: "asc" } });
  const eligible = rewards.filter((r: { level: number }) => r.level <= level);
  if (eligible.length === 0) return;

  try {
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
    const member = await guild.members.fetch(userId);

    let toAdd: string[];
    let toRemove: string[] = [];

    if (stackRoles) {
      toAdd = eligible.map((r: { roleId: string }) => r.roleId);
    } else {
      const top = Math.max(...eligible.map((r: { level: number }) => r.level));
      toAdd = eligible.filter((r: { level: number }) => r.level === top).map((r: { roleId: string }) => r.roleId);
      toRemove = rewards.map((r: { roleId: string }) => r.roleId).filter((id: string) => !toAdd.includes(id));
    }

    for (const roleId of toAdd) {
      if (guild.roles.cache.has(roleId) && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch((err) => console.error(`[levels] add role ${roleId} -> ${userId}`, err));
      }
    }
    for (const roleId of toRemove) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch((err) => console.error(`[levels] remove role ${roleId} <- ${userId}`, err));
      }
    }
  } catch (err) {
    console.error(`[levels] Failed to apply role rewards for ${userId}`, err);
  }
}
