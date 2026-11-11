import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { COLUMN, LOG_CATEGORIES, getLogChannels, invalidateLogChannels, type LogCategory } from "../config.js";

export const logConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("log-config")
    .setDescription("Choose where each kind of log is sent. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) => o.setName("message_channel").setDescription("Deleted and edited messages").addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName("member_channel").setDescription("Joins, leaves, nickname and role changes").addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName("moderation_channel").setDescription("Bans, unbans, kicks and timeouts").addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName("server_channel").setDescription("Channel, role and server setting changes").addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName("voice_channel").setDescription("Voice channel joins, leaves and moves").addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) =>
      o
        .setName("clear")
        .setDescription("Stop one kind of log")
        .addChoices(...LOG_CATEGORIES.map((c) => ({ name: c.label, value: c.key })), { name: "All logs", value: "all" }),
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const o = interaction.options;

    const data: Record<string, string | null> = {};
    for (const { key } of LOG_CATEGORIES) {
      const channel = o.getChannel(`${key}_channel`);
      if (channel) data[COLUMN[key]] = channel.id;
    }
    const clear = o.getString("clear");
    if (clear === "all") for (const { key } of LOG_CATEGORIES) data[COLUMN[key]] = null;
    else if (clear) data[COLUMN[clear as LogCategory]] = null;

    const touched = Object.keys(data).length > 0;
    if (touched) {
      await prisma.logSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
      invalidateLogChannels(guild.id);
    }

    const channels = await getLogChannels(guild.id);
    const body = LOG_CATEGORIES.map((c) => `**${c.label}:** ${channels[c.key] ? `<#${channels[c.key]}>` : "off"}\n> ${c.description}`).join("\n\n");
    const container = touched ? notice.success(body, "Log settings updated") : panel({ title: "Log settings", body });

    const me = guild.members.me;
    const warnings: string[] = [];
    if ((channels.moderation || channels.server) && me && !me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      warnings.push("I'm missing the **View Audit Log** permission, so Moderation and Server logs can't be recorded.");
    }
    for (const c of LOG_CATEGORIES) {
      const id = channels[c.key];
      const channel = id ? guild.channels.cache.get(id) : null;
      if (channel && me && !channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel)) {
        warnings.push(`I can't send messages in <#${id}> (${c.label} logs).`);
      }
    }
    for (const w of warnings) container.addTextDisplayComponents(callout.warning(w));
    container.addTextDisplayComponents(callout.tip("Make the log channels private to your staff. Deleted and edited message text is recorded in them."));

    await interaction.reply(v2Ephemeral(container));
  },
});
