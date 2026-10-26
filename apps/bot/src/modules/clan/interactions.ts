import { prisma } from "@lumii/database";
import type { InteractionHandler } from "../../core/types.js";
import { notice, v2, v2Ephemeral } from "../../core/panel.js";
import { applicantPanel, buildRivalsModal, parseRivalsModal } from "../_shared/rivals-form.js";

export const clanInteractions: InteractionHandler[] = [
  // 常設パネルの「Apply」ボタン → モーダルを開く
  {
    prefix: "clan:apply",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;

      const settings = await prisma.clanSettings.findUnique({ where: { guildId: interaction.guildId } });
      if (!settings?.reviewChannelId) {
        await interaction.reply(v2Ephemeral(notice.error("Clan applications aren't set up yet. Please contact an admin.")));
        return;
      }
      await interaction.showModal(buildRivalsModal("clan:submit", "Clan Application"));
    },
  },

  // モーダル送信 → 審査チャンネルに回答を送る
  {
    prefix: "clan:submit",
    async execute(interaction) {
      if (!interaction.isModalSubmit() || !interaction.guildId) return;

      const parsed = parseRivalsModal(interaction);
      if (!parsed.ok) {
        await interaction.reply(v2Ephemeral(notice.error(parsed.error, "Invalid answer")));
        return;
      }

      const settings = await prisma.clanSettings.findUnique({ where: { guildId: interaction.guildId } });
      const channel = settings?.reviewChannelId
        ? await interaction.client.channels.fetch(settings.reviewChannelId).catch(() => null)
        : null;
      if (!channel?.isSendable()) {
        await interaction.reply(v2Ephemeral(notice.error("I can't reach the review channel. Please contact an admin.")));
        return;
      }

      await channel.send(
        v2(
          applicantPanel({
            title: "New Clan Application",
            intro: `<@${interaction.user.id}> (\`${interaction.user.username}\`) applied to join.`,
            user: interaction.user,
            answers: parsed.answers,
          }),
        ),
      );

      await interaction.reply(v2Ephemeral(notice.success("Your application has been submitted. Our staff will review it soon!", "Application sent")));
    },
  },
];
