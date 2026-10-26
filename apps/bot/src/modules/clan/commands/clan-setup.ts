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
import { addCredit, callout, notice, panel, v2, v2Ephemeral } from "../../../core/panel.js";

export const clanSetup = defineCommand({
  data: new SlashCommandBuilder()
    .setName("clan-setup")
    .setDescription("Post the clan application panel and choose where applications are sent.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("panel_channel").setDescription("Channel to post the application panel in").addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addChannelOption((o) =>
      o.setName("review_channel").setDescription("Admin-only channel that receives applications").addChannelTypes(ChannelType.GuildText).setRequired(true),
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelChannel = await guild.channels.fetch(interaction.options.getChannel("panel_channel", true).id);
    const reviewChannel = await guild.channels.fetch(interaction.options.getChannel("review_channel", true).id);
    if (panelChannel?.type !== ChannelType.GuildText || reviewChannel?.type !== ChannelType.GuildText) {
      await interaction.editReply(v2(notice.error("Both channels must be text channels.")));
      return;
    }

    // 以前のパネルがあれば削除して置き換える
    const prev = await prisma.clanSettings.findUnique({ where: { guildId: guild.id } });
    if (prev?.panelChannelId && prev.panelMessageId) {
      const oldChannel = await guild.channels.fetch(prev.panelChannelId).catch(() => null);
      if (oldChannel?.isTextBased()) await oldChannel.messages.delete(prev.panelMessageId).catch(() => undefined);
    }

    const container = panel({
      title: "Clan Application",
      body: "Want to join the clan? Press the button below and fill out the short form.\nOur staff will review your answers.",
    }).addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("clan:apply").setLabel("Apply").setStyle(ButtonStyle.Primary),
      ),
    );
    addCredit(container);
    const message = await panelChannel.send(v2(container));

    await prisma.clanSettings.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, panelChannelId: panelChannel.id, panelMessageId: message.id, reviewChannelId: reviewChannel.id },
      update: { panelChannelId: panelChannel.id, panelMessageId: message.id, reviewChannelId: reviewChannel.id },
    });

    // 審査チャンネルが全員に見える状態だと回答が漏れるので警告する
    const publiclyVisible = reviewChannel.permissionsFor(guild.roles.everyone).has(PermissionFlagsBits.ViewChannel);
    const done = notice.success(`Panel posted in ${panelChannel}.\nApplications will be sent to ${reviewChannel}.`, "Clan panel ready");
    if (publiclyVisible) {
      done.addTextDisplayComponents(
        callout.warning(`<#${reviewChannel.id}> is visible to @everyone. Restrict it to admins so applications stay private.`),
      );
    }
    await interaction.editReply(v2(done));
  },
});
