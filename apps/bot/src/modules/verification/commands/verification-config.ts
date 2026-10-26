import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { canBotAssignRole, ROLE_HIERARCHY_HINT } from "../../_shared/roles.js";
import { getVerificationConfig } from "../service.js";

export const verificationConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("verification-config")
    .setDescription("View or change verification settings. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn verification on or off"))
    .addRoleOption((o) => o.setName("verified_role").setDescription("Role given after verifying"))
    .addRoleOption((o) => o.setName("unverified_role").setDescription("Role given to new members until they verify"))
    .addBooleanOption((o) => o.setName("clear_unverified_role").setDescription("Stop giving an unverified role to new members")),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;

    const enabled = interaction.options.getBoolean("enabled");
    const verified = interaction.options.getRole("verified_role");
    const unverified = interaction.options.getRole("unverified_role");
    const clearUnverified = interaction.options.getBoolean("clear_unverified_role");
    const touched = enabled !== null || verified || unverified || clearUnverified;

    const warnings: string[] = [];
    if (touched) {
      const data = {
        ...(enabled !== null && { enabled }),
        ...(verified && { verifiedRoleId: verified.id }),
        ...(unverified && { unverifiedRoleId: unverified.id }),
        ...(clearUnverified && !unverified && { unverifiedRoleId: null }),
      };
      await prisma.verificationSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
      if ([verified?.id, unverified?.id].filter((id): id is string => !!id).some((id) => !canBotAssignRole(guild, id))) {
        warnings.push(ROLE_HIERARCHY_HINT);
      }
    }

    const c = await getVerificationConfig(guild.id);
    const body = c
      ? [
          `**Verification:** ${c.enabled ? "on" : "off"}`,
          `**Verified role:** ${c.verifiedRoleId ? `<@&${c.verifiedRoleId}>` : "not set"}`,
          `**Unverified role:** ${c.unverifiedRoleId ? `<@&${c.unverifiedRoleId}>` : "none"}`,
        ].join("\n")
      : "Verification isn't set up yet. Use `/verification-setup` to post the panel.";

    const container = touched ? notice.success(body, "Verification settings updated") : panel({ title: "Verification settings", body });
    for (const w of warnings) container.addTextDisplayComponents(callout.warning(w));
    await interaction.reply(v2Ephemeral(container));
  },
});
