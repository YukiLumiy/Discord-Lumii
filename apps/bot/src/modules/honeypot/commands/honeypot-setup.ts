import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { addCredit, callout, COLORS, notice, panel, v2 } from "../../../core/panel.js";
import { ACTION_CHOICES, ACTION_LABELS, invalidateHoneypotConfig, type HoneypotAction } from "../config.js";

export const honeypotSetup = defineCommand({
  data: new SlashCommandBuilder()
    .setName("honeypot-setup")
    .setDescription("Choose the honeypot channel and post a warning panel in it.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("channel").setDescription("The trap channel (anyone who writes here is punished)").addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addStringOption((o) => o.setName("action").setDescription("What happens to anyone who writes there (default: ban)").addChoices(...ACTION_CHOICES))
    .addChannelOption((o) => o.setName("log_channel").setDescription("Channel for honeypot logs").addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await guild.channels.fetch(interaction.options.getChannel("channel", true).id);
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.editReply(v2(notice.error("The honeypot channel must be a text channel.")));
      return;
    }
    const action = (interaction.options.getString("action") ?? "ban") as HoneypotAction;
    const logChannel = interaction.options.getChannel("log_channel");

    // 罠チャンネルに入ってきた人が、書き込んではいけないと分かるように警告を置く
    const warning = panel({
      title: "Do not write in this channel",
      body: `This channel is a security trap for spam bots and hacked accounts.\nAnyone who sends a message here will be **${ACTION_LABELS[action]}** automatically.\n\nIf you can see this, simply do not type anything here.`,
      color: COLORS.danger,
    });
    addCredit(warning);
    await channel.send(v2(warning)).catch(() => undefined);

    const data = { enabled: true, channelId: channel.id, action, ...(logChannel && { logChannelId: logChannel.id }) };
    await prisma.honeypotSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
    invalidateHoneypotConfig(guild.id);

    const done = notice.success(
      [`**Channel:** <#${channel.id}>`, `**Action:** ${ACTION_LABELS[action]}`, `**Log channel:** ${logChannel ? `<#${logChannel.id}>` : "not set"}`].join("\n"),
      "Honeypot ready",
    );
    done.addTextDisplayComponents(
      callout.tip("Make the channel visible to everyone, and place it where bots that scan channels top to bottom reach it early. Staff with Administrator or Manage Server are never punished, so test with a separate account."),
    );
    if (!logChannel) done.addTextDisplayComponents(callout.warning("No log channel is set, so you won't be told when it triggers. Set one with `/honeypot-config log_channel`."));
    await interaction.editReply(v2(done));
  },
});
