import { prisma } from "@lumii/database";
import type { InteractionHandler } from "../../core/types.js";
import { notice, v2, v2Ephemeral } from "../../core/panel.js";
import { buildRankReply } from "./commands/rank.js";
import { buildLeaderboardReply } from "./commands/leaderboard.js";
import { buildLevelUpPanel } from "./panels.js";

export const levelsInteractions: InteractionHandler[] = [
  // ランクパネルの Refresh
  {
    prefix: "levels:rank:",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;
      const userId = interaction.customId.split(":")[2]!;
      await interaction.deferUpdate();
      const target = await interaction.client.users.fetch(userId);
      await interaction.editReply(await buildRankReply(interaction.guildId, target));
    },
  },

  // リーダーボードの Refresh
  {
    prefix: "levels:lb",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;
      await interaction.deferUpdate();
      await interaction.editReply(await buildLeaderboardReply(interaction.client, interaction.guildId));
    },
  },

  // レベルアップパネルの  ボタン
  {
    prefix: "levels:celebrate:",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;
      const targetUserId = interaction.customId.split(":")[2]!;

      if (interaction.user.id === targetUserId) {
        await interaction.reply(v2Ephemeral(notice.error("You can't celebrate your own level up — let others do it!", "Nice try")));
        return;
      }

      const post = await prisma.levelUpPost.findUnique({ where: { messageId: interaction.message.id } });
      if (!post) {
        await interaction.reply(v2Ephemeral(notice.error("This level-up panel is no longer tracked.")));
        return;
      }

      // 1人1回(重複は @@unique で弾く)
      try {
        await prisma.levelUpCelebration.create({
          data: { guildId: interaction.guildId, messageId: post.messageId, targetUserId, celebratorId: interaction.user.id },
        });
      } catch {
        await interaction.reply(v2Ephemeral(notice.info("You've already celebrated this level up.", "Already celebrated")));
        return;
      }

      const count = await prisma.levelUpCelebration.count({ where: { messageId: post.messageId } });
      // 画像は元のメッセージに添付されたまま残るので、パネルだけ作り直して更新する
      await interaction.update(v2(buildLevelUpPanel({ userId: post.userId, text: post.text }, count)));
    },
  },
];
