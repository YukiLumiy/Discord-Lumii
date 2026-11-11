import { defineEvent } from "../../../core/types.js";
import { COLORS } from "../../../core/panel.js";
import { logPanel, mention, sendLog } from "../service.js";

export const logVoiceState = defineEvent({
  name: "voiceStateUpdate",
  async execute(before, after) {
    const user = after.member?.user ?? before.member?.user;
    if (!user || user.bot) return;
    // ミュートや画面共有などの切り替えではなく、チャンネルの移動だけを記録する
    if (before.channelId === after.channelId) return;

    const [title, color, detail] = !before.channelId
      ? ["Joined voice", COLORS.success, `**Channel:** <#${after.channelId}>`]
      : !after.channelId
        ? ["Left voice", COLORS.danger, `**Channel:** <#${before.channelId}>`]
        : ["Moved voice channel", COLORS.neutral, `**From:** <#${before.channelId}>\n**To:** <#${after.channelId}>`];

    await sendLog(
      after.client,
      after.guild.id,
      "voice",
      logPanel({
        title,
        color,
        thumbnailUrl: user.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [`**User:** ${mention(user.id)}`, detail],
      }),
    );
  },
});
