import { defineEvent } from "../../../core/types.js";
import { v2 } from "../../../core/panel.js";
import { buildLeavePanel, getWelcomeConfig } from "../service.js";

export const welcomeOnLeave = defineEvent({
  name: "guildMemberRemove",
  async execute(member) {
    if (member.user.bot) return;

    const config = await getWelcomeConfig(member.guild.id);
    if (!config?.leaveEnabled || !config.leaveChannelId) return;

    const channel = await member.client.channels.fetch(config.leaveChannelId).catch(() => null);
    if (!channel?.isSendable()) return;

    await channel.send(
      v2(
        buildLeavePanel({
          userId: member.id,
          username: member.user.username,
          server: member.guild.name,
          count: member.guild.memberCount,
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 }),
          template: config.leaveMessage,
          // キャッシュに無い(partial)場合は joinedTimestamp が null になる
          joinedAtUnix: member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : undefined,
        }),
      ),
    );
  },
});
