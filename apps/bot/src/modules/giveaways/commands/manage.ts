import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "@lumii/database";
import { notice, panel, v2, v2Ephemeral } from "../../../core/panel.js";
import { cancelGiveaway, endGiveaway, rerollGiveaway } from "../service.js";

const jump = (g: { guildId: string; channelId: string; messageId: string | null }) =>
  `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}`;

/** 他のサーバーの抽選を操作されないよう、guildId も条件に含めて取得する */
async function findOwn(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString("giveaway", true);
  return prisma.giveaway.findFirst({ where: { id, guildId: interaction.guildId! } });
}

export async function endNow(interaction: ChatInputCommandInteraction): Promise<void> {
  const g = await findOwn(interaction);
  if (!g) return void (await interaction.reply(v2Ephemeral(notice.error("I couldn't find that giveaway."))));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await endGiveaway(interaction.client, g.id);
  await interaction.editReply(
    v2(result === "ended" ? notice.success(`**${g.prize}** has been ended and the winners were drawn.`, "Giveaway ended") : notice.error("That giveaway has already ended or was cancelled.")),
  );
}

export async function cancel(interaction: ChatInputCommandInteraction): Promise<void> {
  const g = await findOwn(interaction);
  if (!g) return void (await interaction.reply(v2Ephemeral(notice.error("I couldn't find that giveaway."))));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const ok = await cancelGiveaway(interaction.client, g.id);
  await interaction.editReply(
    v2(ok ? notice.success(`**${g.prize}** was cancelled. No winners were drawn.`, "Giveaway cancelled") : notice.error("That giveaway has already ended or was cancelled.")),
  );
}

export async function reroll(interaction: ChatInputCommandInteraction): Promise<void> {
  const g = await findOwn(interaction);
  if (!g) return void (await interaction.reply(v2Ephemeral(notice.error("I couldn't find that giveaway."))));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await rerollGiveaway(interaction.client, g.id, interaction.options.getInteger("winners") ?? 1);
  await interaction.editReply(
    v2(
      result.ok
        ? notice.success(`Drew **${result.winnerIds.length}** new winner${result.winnerIds.length > 1 ? "s" : ""} for **${g.prize}**.`, "Reroll complete")
        : notice.error(result.reason, "Reroll failed"),
    ),
  );
}

export async function list(interaction: ChatInputCommandInteraction): Promise<void> {
  const rows = await prisma.giveaway.findMany({
    where: { guildId: interaction.guildId!, ended: false, cancelled: false },
    orderBy: { endsAt: "asc" },
    take: 15,
    include: { _count: { select: { entries: true } } },
  });

  if (rows.length === 0) {
    await interaction.reply(v2Ephemeral(notice.info("There are no active giveaways. Start one with `/giveaway start`.", "Active giveaways")));
    return;
  }

  const lines = rows.map(
    (g: { prize: string; endsAt: Date; _count: { entries: number }; guildId: string; channelId: string; messageId: string | null }) =>
      `**${g.prize}**\n> Ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> | **${g._count.entries}** entries | [Jump](${jump(g)})`,
  );
  await interaction.reply(v2Ephemeral(panel({ title: "Active giveaways", body: lines.join("\n\n") })));
}

export async function entrants(interaction: ChatInputCommandInteraction): Promise<void> {
  const g = await findOwn(interaction);
  if (!g) return void (await interaction.reply(v2Ephemeral(notice.error("I couldn't find that giveaway."))));

  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId: g.id }, orderBy: { createdAt: "asc" } });
  const shown = entries.slice(0, 40).map((e: { userId: string; weight: number }) => `<@${e.userId}>${e.weight > 1 ? ` (x${e.weight})` : ""}`);
  const more = entries.length > shown.length ? `\n\n*...and ${entries.length - shown.length} more*` : "";

  await interaction.reply(
    v2Ephemeral(
      panel({
        title: `Entrants: ${g.prize}`,
        body: entries.length ? `**${entries.length}** total\n\n${shown.join("\n")}${more}` : "No one has entered yet.",
      }),
    ),
  );
}
