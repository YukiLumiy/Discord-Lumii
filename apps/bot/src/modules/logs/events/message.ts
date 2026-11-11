import { defineEvent } from "../../../core/types.js";
import { COLORS } from "../../../core/panel.js";
import { codeBlock, logPanel, mention, sendLog } from "../service.js";

export const logMessageDelete = defineEvent({
  name: "messageDelete",
  async execute(message) {
    if (!message.guildId || message.author?.bot) return;

    const attachments = message.attachments?.size ? `**Attachments:** ${message.attachments.size}` : null;
    await sendLog(
      message.client,
      message.guildId,
      "message",
      logPanel({
        title: "Message deleted",
        color: COLORS.danger,
        thumbnailUrl: message.author?.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [
          `**Author:** ${mention(message.author?.id)}`,
          `**Channel:** <#${message.channelId}>`,
          attachments,
          // 起動前に送られたメッセージなどはキャッシュに無く、内容を取得できない
          message.content === null ? "**Content:** *not available (the message was sent before I could see it)*" : `**Content:**\n${codeBlock(message.content)}`,
          `-# Message ID: ${message.id}`,
        ],
      }),
    );
  },
});

export const logMessageUpdate = defineEvent({
  name: "messageUpdate",
  async execute(before, after) {
    if (!after.guildId || after.author?.bot) return;
    // 編集前の内容が分からない場合や、内容が変わっていない更新(リンクのプレビュー表示など)は記録しない
    if (before.content === null || before.content === after.content) return;

    await sendLog(
      after.client,
      after.guildId,
      "message",
      logPanel({
        title: "Message edited",
        thumbnailUrl: after.author?.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [
          `**Author:** ${mention(after.author?.id)}`,
          `**Channel:** <#${after.channelId}>`,
          `**Before:**\n${codeBlock(before.content)}`,
          `**After:**\n${codeBlock(after.content)}`,
          `**Jump:** ${after.url}`,
        ],
      }),
    );
  },
});

export const logMessageBulkDelete = defineEvent({
  name: "messageDeleteBulk",
  async execute(messages, channel) {
    await sendLog(
      channel.client,
      channel.guildId,
      "message",
      logPanel({
        title: "Messages bulk deleted",
        color: COLORS.danger,
        lines: [`**Channel:** <#${channel.id}>`, `**Deleted:** ${messages.size} message${messages.size === 1 ? "" : "s"}`],
      }),
    );
  },
});
