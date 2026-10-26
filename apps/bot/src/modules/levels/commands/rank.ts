import { AttachmentBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type User } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panelWithImage, v2 } from "../../../core/panel.js";
import { calculateLevel } from "../xp.js";
import { generateRankCard } from "../rankcard.js";

/** /rank と Refreshボタンで共通のパネル生成。 */
export async function buildRankReply(guildId: string, target: User) {
  const row = await prisma.userLevel.findUnique({ where: { guildId_userId: { guildId, userId: target.id } } });

  if (!row) {
    return { ...v2(notice.info(`<@${target.id}> hasn't earned any XP yet.`, "Rank")), files: [] };
  }

  const higher = await prisma.userLevel.count({ where: { guildId, xp: { gt: row.xp } } });
  const { level, currentLevelXp, xpForNextLevel } = calculateLevel(row.xp);

  const image = await generateRankCard({
    username: target.displayName,
    avatar: target.displayAvatarURL({ extension: "png", size: 128 }),
    level,
    currentLevelXp,
    xpForNextLevel,
    rank: higher + 1,
  });

  const container = panelWithImage({
    title: `${target.displayName}'s Rank`,
    imageName: "rank.png",
    buttons: [new ButtonBuilder().setCustomId(`levels:rank:${target.id}`).setLabel("Refresh").setStyle(ButtonStyle.Secondary)],
  });
  return { ...v2(container), files: [new AttachmentBuilder(image, { name: "rank.png" })] };
}

export const rank = defineCommand({
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your (or another member's) level and XP.")
    .addUserOption((o) => o.setName("user").setDescription("Member to check (default: you)")),

  async execute(interaction) {
    if (!interaction.guildId) return;
    const target = interaction.options.getUser("user") ?? interaction.user;
    await interaction.deferReply();
    await interaction.editReply(await buildRankReply(interaction.guildId, target));
  },
});
