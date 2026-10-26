import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type Guild } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panel, text, v2Ephemeral } from "../../../core/panel.js";
import { DEFAULT_LEAVE_MESSAGE, DEFAULT_WELCOME_MESSAGE, getWelcomeConfig } from "../service.js";

const PLACEHOLDERS = "Placeholders: {user} {username} {server} {count}";

/** 指定チャンネルにBotが書き込めるか */
function canSend(guild: Guild, channelId: string): boolean {
  const channel = guild.channels.cache.get(channelId);
  const me = guild.members.me;
  if (!channel || !me) return false;
  return channel.permissionsFor(me).has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages);
}

export const welcomeConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("welcome-config")
    .setDescription("View or change welcome/leave messages. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("welcome_enabled").setDescription("Turn welcome messages on or off"))
    .addChannelOption((o) => o.setName("welcome_channel").setDescription("Channel for welcome messages").addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName("welcome_message").setDescription(`Welcome text. ${PLACEHOLDERS}`).setMaxLength(500))
    .addBooleanOption((o) => o.setName("leave_enabled").setDescription("Turn leave messages on or off"))
    .addChannelOption((o) => o.setName("leave_channel").setDescription("Channel for leave messages").addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName("leave_message").setDescription(`Leave text. ${PLACEHOLDERS}`).setMaxLength(500))
    .addBooleanOption((o) => o.setName("reset_messages").setDescription("Restore the default welcome and leave texts")),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const o = interaction.options;

    const welcomeChannel = o.getChannel("welcome_channel");
    const leaveChannel = o.getChannel("leave_channel");
    const reset = o.getBoolean("reset_messages") === true;

    const data = {
      ...(o.getBoolean("welcome_enabled") !== null && { welcomeEnabled: o.getBoolean("welcome_enabled")! }),
      ...(welcomeChannel && { welcomeChannelId: welcomeChannel.id }),
      ...(o.getString("welcome_message") && { welcomeMessage: o.getString("welcome_message")! }),
      ...(o.getBoolean("leave_enabled") !== null && { leaveEnabled: o.getBoolean("leave_enabled")! }),
      ...(leaveChannel && { leaveChannelId: leaveChannel.id }),
      ...(o.getString("leave_message") && { leaveMessage: o.getString("leave_message")! }),
      ...(reset && { welcomeMessage: null, leaveMessage: null }),
    };
    const touched = Object.keys(data).length > 0;
    if (touched) {
      await prisma.welcomeSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
    }

    const c = await getWelcomeConfig(guild.id);
    const describe = (enabled: boolean | undefined, channelId: string | null | undefined, message: string | null | undefined, fallback: string) =>
      [
        `${enabled ? "on" : "off"} → ${channelId ? `<#${channelId}>` : "**no channel set**"}`,
        `> ${message ?? fallback}${message ? "" : " *(default)*"}`,
      ].join("\n");

    const body = [
      `**Welcome:** ${describe(c?.welcomeEnabled, c?.welcomeChannelId, c?.welcomeMessage, DEFAULT_WELCOME_MESSAGE)}`,
      `**Leave:** ${describe(c?.leaveEnabled, c?.leaveChannelId, c?.leaveMessage, DEFAULT_LEAVE_MESSAGE)}`,
    ].join("\n\n");

    const container = touched ? notice.success(body, "Welcome settings updated") : panel({ title: "Welcome settings", body });
    container.addTextDisplayComponents(text(`-# ${PLACEHOLDERS}`));

    // 有効なのにチャンネル未設定 / Botが書き込めない場合は知らせる
    const problems: string[] = [];
    if (c?.welcomeEnabled && !c.welcomeChannelId) problems.push("Welcome messages are on, but no `welcome_channel` is set.");
    if (c?.leaveEnabled && !c.leaveChannelId) problems.push("Leave messages are on, but no `leave_channel` is set.");
    if (c?.welcomeChannelId && !canSend(guild, c.welcomeChannelId)) problems.push(`I can't send messages in <#${c.welcomeChannelId}>.`);
    if (c?.leaveChannelId && !canSend(guild, c.leaveChannelId)) problems.push(`I can't send messages in <#${c.leaveChannelId}>.`);
    if (problems.length) container.addTextDisplayComponents(text(problems.map((p) => `**Warning:** ${p}`).join("\n")));

    await interaction.reply(v2Ephemeral(container));
  },
});
