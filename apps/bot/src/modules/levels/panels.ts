import { AttachmentBuilder, ButtonBuilder, ButtonStyle, type Client, type User } from "discord.js";
import { prisma } from "@lumii/database";
import { CREDIT, panelWithImage, v2 } from "../../core/panel.js";
import { generateLevelUpImage } from "./rankcard.js";
import type { LevelConfig } from "./settings.js";

export const LEVELUP_IMAGE = "levelup.png";

/** テンプレートの {user} {username} {level} {server} を展開する */
export function renderLevelUpMessage(template: string, vars: { userId: string; username: string; level: number; server: string }): string {
  return template
    .replaceAll("{user}", `<@${vars.userId}>`)
    .replaceAll("{username}", vars.username)
    .replaceAll("{level}", String(vars.level))
    .replaceAll("{server}", vars.server);
}

/** ボタン。customId = levels:celebrate:<レベルアップしたユーザーID> */
export function celebrateButton(targetUserId: string, count: number): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`levels:celebrate:${targetUserId}`)
    .setLabel(count > 0 ? `Celebrate (${count})` : "Celebrate")
    .setStyle(ButtonStyle.Secondary);
}

/** レベルアップ祝福パネル(画像 + 文面 + ボタン) */
export function buildLevelUpPanel(post: { userId: string; text: string }, celebrations: number) {
  return panelWithImage({
    title: "Level Up!",
    text: post.text,
    imageName: LEVELUP_IMAGE,
    buttons: [celebrateButton(post.userId, celebrations)],
    footer: CREDIT,
  });
}

/** 指定チャンネルにレベルアップパネルを送り、祝福の集計用にDBへ記録する */
export async function sendLevelUpPanel(opts: {
  client: Client;
  guildId: string;
  guildName: string;
  channelId: string;
  user: User;
  oldLevel: number;
  newLevel: number;
  config: LevelConfig;
}): Promise<void> {
  const { client, user, config } = opts;

  const channel = await client.channels.fetch(opts.channelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const text = renderLevelUpMessage(config.levelUpMessage, {
    userId: user.id,
    username: user.username,
    level: opts.newLevel,
    server: opts.guildName,
  });

  const image = await generateLevelUpImage({
    username: user.displayName,
    avatar: user.displayAvatarURL({ extension: "png", size: 128 }),
    oldLevel: opts.oldLevel,
    newLevel: opts.newLevel,
  });

  const message = await channel.send({
    ...v2(buildLevelUpPanel({ userId: user.id, text }, 0)),
    files: [new AttachmentBuilder(image, { name: LEVELUP_IMAGE })],
  });

  await prisma.levelUpPost.create({
    data: { messageId: message.id, guildId: opts.guildId, userId: user.id, oldLevel: opts.oldLevel, newLevel: opts.newLevel, text },
  });
}
