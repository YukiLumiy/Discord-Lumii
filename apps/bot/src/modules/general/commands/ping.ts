import { SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../../../core/types.js";
import { notice, v2Ephemeral } from "../../../core/panel.js";

export const ping = defineCommand({
  data: new SlashCommandBuilder().setName("ping").setDescription("Check if Lumii is awake."),
  async execute(interaction) {
    await interaction.reply(v2Ephemeral(notice.info(`Pong! \`${interaction.client.ws.ping}ms\``, "Lumii")));
  },
});
