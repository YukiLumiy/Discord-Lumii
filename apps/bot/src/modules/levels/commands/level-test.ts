import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../../../core/types.js";
import { notice, v2Ephemeral } from "../../../core/panel.js";
import { getLevelConfig } from "../settings.js";
import { sendLevelUpPanel } from "../panels.js";

/** 設定したチャンネルにレベルアップパネルのテストを送る(ボタンの動作確認用)。 */
export const levelTest = defineCommand({
  data: new SlashCommandBuilder()
    .setName("level-test")
    .setDescription("Send a test level-up panel for yourself.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;

    const config = await getLevelConfig(guild.id);
    const channelId = config.levelUpChannelId ?? interaction.channelId;
    await sendLevelUpPanel({
      client: interaction.client,
      guildId: guild.id,
      guildName: guild.name,
      channelId,
      user: interaction.user,
      oldLevel: 4,
      newLevel: 5,
      config,
    });
    await interaction.reply(v2Ephemeral(notice.success(`Sent a test level-up panel to <#${channelId}>.`, "Test sent")));
  },
});
