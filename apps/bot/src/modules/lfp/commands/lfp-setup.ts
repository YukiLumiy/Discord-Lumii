import { MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { addCredit, notice, panel, v2, v2Ephemeral } from "../../../core/panel.js";

export const lfpSetup = defineCommand({
  data: new SlashCommandBuilder()
    .setName("lfp-setup")
    .setDescription("Post the Looking for Playing panel and choose where posts appear.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("panel_channel").setDescription("Channel to post the panel in").addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addChannelOption((o) =>
      o.setName("post_channel").setDescription("Public channel where duo requests are posted").addChannelTypes(ChannelType.GuildText).setRequired(true),
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelChannel = await guild.channels.fetch(interaction.options.getChannel("panel_channel", true).id);
    const postChannel = await guild.channels.fetch(interaction.options.getChannel("post_channel", true).id);
    if (panelChannel?.type !== ChannelType.GuildText || postChannel?.type !== ChannelType.GuildText) {
      await interaction.editReply(v2(notice.error("Both channels must be text channels.")));
      return;
    }

    const prev = await prisma.lfpSettings.findUnique({ where: { guildId: guild.id } });
    if (prev?.panelChannelId && prev.panelMessageId) {
      const oldChannel = await guild.channels.fetch(prev.panelChannelId).catch(() => null);
      if (oldChannel?.isTextBased()) await oldChannel.messages.delete(prev.panelMessageId).catch(() => undefined);
    }

    const container = panel({
      title: "Looking for Playing",
      body: "Looking for a duo partner in Roblox Rivals?\nPress the button below and fill out the form — your post will be shared with everyone.",
    }).addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("lfp:post").setLabel("Find a Duo").setStyle(ButtonStyle.Primary),
      ),
    );
    addCredit(container);
    const message = await panelChannel.send(v2(container));

    await prisma.lfpSettings.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, panelChannelId: panelChannel.id, panelMessageId: message.id, postChannelId: postChannel.id },
      update: { panelChannelId: panelChannel.id, panelMessageId: message.id, postChannelId: postChannel.id },
    });

    await interaction.editReply(
      v2(notice.success(`Panel posted in ${panelChannel}.\nDuo requests will be posted in ${postChannel}.`, "LFP panel ready")),
    );
  },
});
