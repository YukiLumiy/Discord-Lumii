import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { canBotAssignRole, ROLE_HIERARCHY_HINT } from "../../_shared/roles.js";

export const levelRole = defineCommand({
  data: new SlashCommandBuilder()
    .setName("level-role")
    .setDescription("Manage roles that are given when members reach a level.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Give a role at a level")
        .addIntegerOption((o) => o.setName("level").setDescription("Level to reach").setMinValue(1).setMaxValue(1000).setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Role to give").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Stop giving a role at a level")
        .addIntegerOption((o) => o.setName("level").setDescription("Level").setMinValue(1).setMaxValue(1000).setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("list").setDescription("List all level roles")),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const level = interaction.options.getInteger("level", true);
      const role = interaction.options.getRole("role", true);

      if (role.id === guild.id) {
        await interaction.reply(v2Ephemeral(notice.error("You can't use @everyone as a level role.")));
        return;
      }
      await prisma.levelRoleReward.upsert({
        where: { guildId_level_roleId: { guildId: guild.id, level, roleId: role.id } },
        create: { guildId: guild.id, level, roleId: role.id },
        update: {},
      });

      const done = notice.success(`Members who reach **level ${level}** will get <@&${role.id}>.`, "Level role added");
      if (!canBotAssignRole(guild, role.id)) done.addTextDisplayComponents(callout.warning(ROLE_HIERARCHY_HINT));
      await interaction.reply(v2Ephemeral(done));
      return;
    }

    if (sub === "remove") {
      const level = interaction.options.getInteger("level", true);
      const role = interaction.options.getRole("role", true);
      const { count } = await prisma.levelRoleReward.deleteMany({ where: { guildId: guild.id, level, roleId: role.id } });
      await interaction.reply(
        v2Ephemeral(count > 0 ? notice.success(`Removed <@&${role.id}> from level **${level}**.`) : notice.error("That role isn't set for that level.")),
      );
      return;
    }

    // list
    const rewards = await prisma.levelRoleReward.findMany({ where: { guildId: guild.id }, orderBy: { level: "asc" } });
    if (rewards.length === 0) {
      await interaction.reply(v2Ephemeral(notice.info("No level roles yet. Add one with `/level-role add`.", "Level roles")));
      return;
    }
    const byLevel = new Map<number, string[]>();
    for (const r of rewards as { level: number; roleId: string }[]) {
      byLevel.set(r.level, [...(byLevel.get(r.level) ?? []), `<@&${r.roleId}>`]);
    }
    const lines = [...byLevel.entries()].map(([level, roles]) => `**Level ${level}** → ${roles.join(", ")}`).join("\n");
    await interaction.reply(v2Ephemeral(panel({ title: "Level roles", body: lines })));
  },
});
