import type { GuildMember } from "discord.js";
import { prisma } from "@lumii/database";
import type { InteractionHandler } from "../../core/types.js";
import { notice, v2, v2Ephemeral } from "../../core/panel.js";
import { buildGiveawayPanel, type GiveawayView } from "./panels.js";

const DAY_MS = 86_400_000;

export const giveawayInteractions: InteractionHandler[] = [
  // 「Enter Giveaway」ボタン
  {
    prefix: "giveaway:enter:",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;
      const id = interaction.customId.split(":")[2]!;

      const g = await prisma.giveaway.findFirst({ where: { id, guildId: interaction.guildId } });
      if (!g || g.ended || g.cancelled || g.endsAt.getTime() <= Date.now()) {
        await interaction.reply(v2Ephemeral(notice.error("This giveaway is no longer active.")));
        return;
      }

      const member = interaction.member as GuildMember;
      const roles = member.roles.cache;
      const fail = (message: string) => interaction.reply(v2Ephemeral(notice.error(message, "You can't enter this giveaway")));

      if (g.blacklistRoleId && roles.has(g.blacklistRoleId)) return void (await fail("You're not eligible to enter this giveaway."));
      if (g.requiredRoleId && !roles.has(g.requiredRoleId)) return void (await fail(`You need the <@&${g.requiredRoleId}> role to enter.`));

      if (g.minAccountAgeDays) {
        const ageDays = Math.floor((Date.now() - interaction.user.createdTimestamp) / DAY_MS);
        if (ageDays < g.minAccountAgeDays) return void (await fail(`Your Discord account must be at least **${g.minAccountAgeDays}** days old to enter.`));
      }

      if (g.minLevel) {
        const row = await prisma.userLevel.findUnique({ where: { guildId_userId: { guildId: interaction.guildId, userId: interaction.user.id } } });
        const level = row?.level ?? 0;
        if (level < g.minLevel) return void (await fail(`You need to be at least **level ${g.minLevel}** to enter. You're currently level **${level}**.`));
      }

      const weight = g.bonusRoleId && roles.has(g.bonusRoleId) ? g.bonusEntries : 1;

      try {
        await prisma.giveawayEntry.create({ data: { giveawayId: g.id, userId: interaction.user.id, weight } });
      } catch {
        // @@unique([giveawayId, userId]) に違反 = すでに参加済み
        await interaction.reply(v2Ephemeral(notice.info("You've already entered this giveaway. Good luck.", "Already entered")));
        return;
      }

      // 参加人数を反映したパネルに更新(画像は元のメッセージの添付が残る)
      const count = await prisma.giveawayEntry.count({ where: { giveawayId: g.id } });
      await interaction.update(v2(buildGiveawayPanel(g as GiveawayView, count)));
      await interaction.followUp(
        v2Ephemeral(notice.success(weight > 1 ? `You're in, with **${weight}** entries. Good luck.` : "You're in. Good luck.", "Entered")),
      );
    },
  },
];
