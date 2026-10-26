import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../../../core/types.js";
import { v2Ephemeral } from "../../../core/panel.js";
import { buildLeavePanel, buildWelcomePanel, getWelcomeConfig } from "../service.js";

/** 設定した文面でパネルがどう見えるかを、本人にだけ表示して確認する(チャンネルには送らない)。 */
export const welcomeTest = defineCommand({
  data: new SlashCommandBuilder()
    .setName("welcome-test")
    .setDescription("Preview the welcome or leave message (only you can see it).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Which message to preview")
        .setRequired(true)
        .addChoices({ name: "Welcome", value: "welcome" }, { name: "Leave", value: "leave" }),
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;

    const config = await getWelcomeConfig(guild.id);
    const opts = {
      userId: interaction.user.id,
      username: interaction.user.username,
      server: guild.name,
      count: guild.memberCount,
      avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 128 }),
    };

    const container =
      interaction.options.getString("type", true) === "welcome"
        ? buildWelcomePanel({ ...opts, template: config?.welcomeMessage ?? null })
        : buildLeavePanel({ ...opts, template: config?.leaveMessage ?? null, joinedAtUnix: Math.floor(Date.now() / 1000) - 86_400 * 3 });

    await interaction.reply(v2Ephemeral(container));
  },
});
