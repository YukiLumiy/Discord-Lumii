import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../../../core/types.js";
import { notice, v2Ephemeral } from "../../../core/panel.js";
import { endLockdown } from "../service.js";

export const antiRaidUnlock = defineCommand({
  data: new SlashCommandBuilder()
    .setName("antiraid-unlock")
    .setDescription("End an active Anti Raid lockdown now and restore the verification level.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.guildId) return;
    const ended = await endLockdown(interaction.client, interaction.guildId, `Ended manually by <@${interaction.user.id}>.`);
    await interaction.reply(
      v2Ephemeral(
        ended
          ? notice.success("The verification level was restored to what it was before the lockdown.", "Lockdown ended")
          : notice.info("There is no active lockdown.", "Nothing to unlock"),
      ),
    );
  },
});
