import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { getAntiNukeConfig, invalidateAntiNukeConfig } from "../config.js";

export const antiNukeWhitelist = defineCommand({
  data: new SlashCommandBuilder()
    .setName("antinuke-whitelist")
    .setDescription("Choose users and roles that Anti Nuke never punishes.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a user or role to the whitelist")
        .addUserOption((o) => o.setName("user").setDescription("A trusted user or bot"))
        .addRoleOption((o) => o.setName("role").setDescription("A trusted role")),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a user or role from the whitelist")
        .addUserOption((o) => o.setName("user").setDescription("User to remove"))
        .addRoleOption((o) => o.setName("role").setDescription("Role to remove")),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Show the whitelist")),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;
    const sub = interaction.options.getSubcommand();
    const current = await getAntiNukeConfig(guildId);

    if (sub === "list") {
      const users = current.whitelistedUserIds.map((id) => `<@${id}>`).join(", ") || "none";
      const roles = current.whitelistedRoleIds.map((id) => `<@&${id}>`).join(", ") || "none";
      await interaction.reply(v2Ephemeral(panel({ title: "Anti Nuke whitelist", body: `**Users:** ${users}\n**Roles:** ${roles}\n\n-# The server owner and Lumii are always exempt.` })));
      return;
    }

    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");
    if (!user && !role) {
      await interaction.reply(v2Ephemeral(notice.error("Choose a `user` or a `role`.")));
      return;
    }

    const adding = sub === "add";
    const toggle = (list: string[], id: string) => (adding ? [...new Set([...list, id])] : list.filter((x) => x !== id));
    const userIds = user ? toggle(current.whitelistedUserIds, user.id) : current.whitelistedUserIds;
    const roleIds = role ? toggle(current.whitelistedRoleIds, role.id) : current.whitelistedRoleIds;

    const data = { whitelistedUserIds: userIds, whitelistedRoleIds: roleIds };
    await prisma.antiNukeSettings.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
    invalidateAntiNukeConfig(guildId);

    const names = [user ? `<@${user.id}>` : null, role ? `<@&${role.id}>` : null].filter(Boolean).join(" and ");
    await interaction.reply(v2Ephemeral(notice.success(adding ? `${names} added to the whitelist.` : `${names} removed from the whitelist.`, "Whitelist updated")));
  },
});
