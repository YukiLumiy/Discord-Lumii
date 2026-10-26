import { AttachmentBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type Client } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panelWithImage, v2 } from "../../../core/panel.js";
import { calculateLevel } from "../xp.js";
import { generateLeaderboardCard, type LeaderboardEntry } from "../rankcard.js";

export async function buildLeaderboardReply(client: Client, guildId: string) {
  const top = await prisma.userLevel.findMany({ where: { guildId }, orderBy: { xp: "desc" }, take: 10 });

  if (top.length === 0) {
    return { ...v2(notice.info("No one has earned XP yet.", "Leaderboard")), files: [] };
  }

  const entries: LeaderboardEntry[] = [];
  for (const record of top) {
    let username: string = record.userId;
    let avatar: string = client.user!.displayAvatarURL({ extension: "png", size: 64 });
    try {
      const user = await client.users.fetch(record.userId);
      username = user.displayName;
      avatar = user.displayAvatarURL({ extension: "png", size: 64 });
    } catch {
      // 取得できない(退会済みなど)場合はIDのまま表示
    }
    const { level, currentLevelXp, xpForNextLevel } = calculateLevel(record.xp);
    entries.push({ username, avatar, level, currentLevelXp, xpForNextLevel });
  }

  const image = await generateLeaderboardCard(entries);
  const container = panelWithImage({
    title: "Level Leaderboard — Top 10",
    imageName: "leaderboard.png",
    buttons: [new ButtonBuilder().setCustomId("levels:lb").setLabel("Refresh").setStyle(ButtonStyle.Secondary)],
  });
  return { ...v2(container), files: [new AttachmentBuilder(image, { name: "leaderboard.png" })] };
}

export const leaderboard = defineCommand({
  data: new SlashCommandBuilder().setName("leaderboard").setDescription("Show the top 10 members by XP."),

  async execute(interaction) {
    if (!interaction.guildId) return;
    await interaction.deferReply();
    await interaction.editReply(await buildLeaderboardReply(interaction.client, interaction.guildId));
  },
});
