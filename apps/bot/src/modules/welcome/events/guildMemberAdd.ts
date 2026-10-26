import { defineEvent } from "../../../core/types.js";
import { v2 } from "../../../core/panel.js";
import { buildWelcomePanel, getWelcomeConfig } from "../service.js";

export const welcomeOnJoin = defineEvent({
  name: "guildMemberAdd",
  async execute(member) {
    if (member.user.bot) return;

    const config = await getWelcomeConfig(member.guild.id);
    if (!config?.welcomeEnabled || !config.welcomeChannelId) return;

    const channel = await member.client.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel?.isSendable()) return;

    await channel.send(
      v2(
        buildWelcomePanel({
          userId: member.id,
          username: member.user.username,
          server: member.guild.name,
          count: member.guild.memberCount,
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 }),
          template: config.welcomeMessage,
        }),
      ),
    );
  },
});
