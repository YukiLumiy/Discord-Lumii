import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { startGiveaway } from "./start.js";
import { cancel, endNow, entrants, list, reroll } from "./manage.js";

const giveawayOption = (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("giveaway").setDescription("Pick a giveaway").setAutocomplete(true).setRequired(true);

/** サブコマンドに合わせて候補を絞る(end/cancel は開催中のみ、reroll は終了済みのみ) */
async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();
  const state =
    sub === "end" || sub === "cancel" ? { ended: false, cancelled: false } : sub === "reroll" ? { ended: true, cancelled: false } : {};

  const rows = await prisma.giveaway.findMany({
    where: { guildId: interaction.guildId, ...state, prize: { contains: interaction.options.getFocused(), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  await interaction.respond(
    rows.map((g: { id: string; prize: string; ended: boolean; cancelled: boolean }) => {
      const status = g.cancelled ? "cancelled" : g.ended ? "ended" : "active";
      return { name: `${g.prize.slice(0, 80)} (${status})`, value: g.id };
    }),
  );
}

export const giveaway = defineCommand({
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Run giveaways.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("start")
        .setDescription("Start a giveaway.")
        .addStringOption((o) => o.setName("prize").setDescription("What are you giving away?").setMaxLength(200).setRequired(true))
        .addStringOption((o) => o.setName("duration").setDescription("How long it runs, e.g. 30m, 2h, 1d, 1h30m").setRequired(true))
        .addIntegerOption((o) => o.setName("winners").setDescription("Number of winners (default 1)").setMinValue(1).setMaxValue(20))
        .addChannelOption((o) => o.setName("channel").setDescription("Channel to post in (default: this channel)").addChannelTypes(ChannelType.GuildText))
        .addUserOption((o) => o.setName("host").setDescription("Credit a different host (default: you)"))
        .addStringOption((o) => o.setName("description").setDescription("Extra details or rules shown on the panel").setMaxLength(1000))
        .addAttachmentOption((o) => o.setName("image").setDescription("Large image shown on the panel"))
        .addRoleOption((o) => o.setName("ping_role").setDescription("Role to mention when the giveaway starts and ends"))
        .addRoleOption((o) => o.setName("required_role").setDescription("Only members with this role can enter"))
        .addRoleOption((o) => o.setName("blacklist_role").setDescription("Members with this role cannot enter"))
        .addRoleOption((o) => o.setName("bonus_role").setDescription("Members with this role get better odds"))
        .addIntegerOption((o) => o.setName("bonus_entries").setDescription("Entries for bonus_role members (default 2)").setMinValue(2).setMaxValue(10))
        .addIntegerOption((o) => o.setName("min_level").setDescription("Minimum level (from the leveling system) to enter").setMinValue(1).setMaxValue(1000))
        .addIntegerOption((o) => o.setName("min_account_age").setDescription("Minimum Discord account age in days (anti-alt)").setMinValue(1).setMaxValue(365))
        .addRoleOption((o) => o.setName("winners_role").setDescription("Role to give to the winners automatically")),
    )
    .addSubcommand((s) => s.setName("end").setDescription("End a giveaway now and draw the winners.").addStringOption(giveawayOption))
    .addSubcommand((s) => s.setName("cancel").setDescription("Cancel a giveaway without drawing winners.").addStringOption(giveawayOption))
    .addSubcommand((s) =>
      s
        .setName("reroll")
        .setDescription("Draw new winners for an ended giveaway.")
        .addStringOption(giveawayOption)
        .addIntegerOption((o) => o.setName("winners").setDescription("How many new winners to draw (default 1)").setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Show active giveaways."))
    .addSubcommand((s) => s.setName("entrants").setDescription("Show who entered a giveaway.").addStringOption(giveawayOption)),

  autocomplete,

  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case "start":
        return startGiveaway(interaction);
      case "end":
        return endNow(interaction);
      case "cancel":
        return cancel(interaction);
      case "reroll":
        return reroll(interaction);
      case "list":
        return list(interaction);
      case "entrants":
        return entrants(interaction);
    }
  },
});
