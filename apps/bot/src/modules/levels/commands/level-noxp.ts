import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { invalidateLevelCaches } from "../settings.js";

export const levelNoXp = defineCommand({
  data: new SlashCommandBuilder()
    .setName("level-noxp")
    .setDescription("Choose channels where messages don't earn XP.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Stop XP in a channel")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Allow XP in a channel again")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum).setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName("list").setDescription("List channels without XP")),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.levelNoXpChannel.upsert({
        where: { guildId_channelId: { guildId, channelId: channel.id } },
        create: { guildId, channelId: channel.id },
        update: {},
      });
      invalidateLevelCaches(guildId);
      await interaction.reply(v2Ephemeral(notice.success(`Messages in <#${channel.id}> no longer earn XP.`)));
      return;
    }

    if (sub === "remove") {
      const channel = interaction.options.getChannel("channel", true);
      const { count } = await prisma.levelNoXpChannel.deleteMany({ where: { guildId, channelId: channel.id } });
      invalidateLevelCaches(guildId);
      await interaction.reply(
        v2Ephemeral(count > 0 ? notice.success(`Messages in <#${channel.id}> earn XP again.`) : notice.error("That channel isn't on the list.")),
      );
      return;
    }

    const rows = await prisma.levelNoXpChannel.findMany({ where: { guildId } });
    const body = rows.length ? rows.map((r: { channelId: string }) => `<#${r.channelId}>`).join("\n") : "No channels are excluded.";
    await interaction.reply(v2Ephemeral(panel({ title: "No-XP channels", body })));
  },
});
