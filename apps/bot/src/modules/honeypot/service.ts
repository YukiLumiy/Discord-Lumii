import { PermissionFlagsBits, type Message } from "discord.js";
import { COLORS, panel, v2 } from "../../core/panel.js";
import { ACTION_LABELS, getHoneypotConfig, type HoneypotAction, type HoneypotConfig } from "./config.js";

/**
 * Honeypot - 罠チャンネル。普通のユーザーは書き込まない場所に書き込んだアカウント(スパムBotや乗っ取られた
 * アカウント)を自動で処罰する。スタッフ(管理者・サーバー管理権限)と除外ロールの持ち主は対象外。
 */

const TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REASON = "Lumii Honeypot: sent a message in the honeypot channel";

export async function handleHoneypotMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot || message.webhookId) return;

  const config = await getHoneypotConfig(message.guild.id);
  if (!config.enabled || !config.channelId || message.channelId !== config.channelId) return;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));

  // サーバーオーナー、管理系の権限を持つ人、除外ロールの持ち主は対象外
  if (message.author.id === message.guild.ownerId) return;
  if (member?.permissions.has(PermissionFlagsBits.Administrator) || member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  if (member?.roles.cache.some((r) => config.ignoredRoleIds.includes(r.id))) return;

  // まず書き込まれたメッセージを消す(リンクなどが他のユーザーに見えないように)
  const excerpt = describeMessage(message);
  await message.delete().catch(() => undefined);

  const result = await punish(message, config.action, config.deleteMessageSeconds);
  await sendLog(message, config, excerpt, result);
}

async function punish(message: Message, action: HoneypotAction, deleteSeconds: number): Promise<{ ok: boolean; detail: string }> {
  const guild = message.guild!;
  const userId = message.author.id;
  const member = message.member ?? (await guild.members.fetch(userId).catch(() => null));

  try {
    if (action === "ban" || action === "softban") {
      if (member && !member.bannable) return { ok: false, detail: "I can't ban them: their highest role is not below mine, or I'm missing the Ban Members permission." };
      await guild.bans.create(userId, { reason: REASON, deleteMessageSeconds: Math.min(Math.max(deleteSeconds, 0), 604_800) });
      if (action === "softban") await guild.bans.remove(userId, "Lumii Honeypot: soft-ban (messages cleared)");
      return { ok: true, detail: action === "ban" ? "Banned." : "Soft-banned (removed, recent messages deleted, can rejoin)." };
    }

    if (!member) return { ok: false, detail: "They already left the server." };

    if (action === "kick") {
      if (!member.kickable) return { ok: false, detail: "I can't kick them: their highest role is not below mine, or I'm missing the Kick Members permission." };
      await member.kick(REASON);
      return { ok: true, detail: "Kicked." };
    }

    if (!member.moderatable) return { ok: false, detail: "I can't time them out: their highest role is not below mine, or I'm missing the Timeout Members permission." };
    await member.timeout(TIMEOUT_MS, REASON);
    return { ok: true, detail: "Timed out for 24 hours." };
  } catch (err) {
    console.error(`[honeypot] punishment failed for ${userId} in ${guild.id}`, err);
    return { ok: false, detail: "Discord rejected the action. Check my permissions and role position." };
  }
}

/** ログに載せるメッセージの要約。リンクが有効にならないようコードブロックに入れる。 */
function describeMessage(message: Message): string {
  const text = message.content.replace(/`/g, "'").slice(0, 300);
  const attachments = message.attachments.size > 0 ? ` (+${message.attachments.size} attachment${message.attachments.size === 1 ? "" : "s"})` : "";
  return text ? `\`\`\`\n${text}\n\`\`\`${attachments}` : `*no text*${attachments}`;
}

async function sendLog(message: Message, config: HoneypotConfig, excerpt: string, result: { ok: boolean; detail: string }): Promise<void> {
  if (!config.logChannelId) return;
  const channel = await message.client.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const body = [
    `<@${message.author.id}> (\`${message.author.username}\`) wrote in <#${message.channelId}>.`,
    `**Action:** ${ACTION_LABELS[config.action]}`,
    `**Result:** ${result.detail}`,
    `**Message:**\n${excerpt}`,
  ].join("\n");

  await channel
    .send(v2(panel({ title: result.ok ? "Honeypot triggered" : "Honeypot triggered, but the action failed", body, color: result.ok ? COLORS.danger : COLORS.neutral })))
    .catch((err) => console.error("[honeypot] failed to send log", err));
}
