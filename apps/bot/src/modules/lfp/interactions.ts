import { prisma } from "@lumii/database";
import type { InteractionHandler } from "../../core/types.js";
import { notice, v2, v2Ephemeral } from "../../core/panel.js";
import { applicantPanel, buildRivalsModal, parseRivalsModal } from "../_shared/rivals-form.js";

export const lfpInteractions: InteractionHandler[] = [
  {
    prefix: "lfp:post",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;

      const settings = await prisma.lfpSettings.findUnique({ where: { guildId: interaction.guildId } });
      if (!settings?.postChannelId) {
        await interaction.reply(v2Ephemeral(notice.error("Looking for Playing isn't set up yet. Please contact an admin.")));
        return;
      }
      await interaction.showModal(buildRivalsModal("lfp:submit", "Looking for Playing"));
    },
  },

  {
    prefix: "lfp:submit",
    async execute(interaction) {
      if (!interaction.isModalSubmit() || !interaction.guildId) return;

      const parsed = parseRivalsModal(interaction);
      if (!parsed.ok) {
        await interaction.reply(v2Ephemeral(notice.error(parsed.error, "Invalid answer")));
        return;
      }

      const settings = await prisma.lfpSettings.findUnique({ where: { guildId: interaction.guildId } });
      const channel = settings?.postChannelId
        ? await interaction.client.channels.fetch(settings.postChannelId).catch(() => null)
        : null;
      if (!channel?.isSendable()) {
        await interaction.reply(v2Ephemeral(notice.error("I can't reach the posting channel. Please contact an admin.")));
        return;
      }

      const posted = await channel.send(
        v2(
          applicantPanel({
            title: "Looking for Duo",
            intro: `<@${interaction.user.id}> is looking for a duo partner in Roblox Rivals!`,
            user: interaction.user,
            answers: parsed.answers,
          }),
        ),
      );

      await interaction.reply(v2Ephemeral(notice.success(`Your post is live: ${posted.url}`, "Posted")));
    },
  },
];
