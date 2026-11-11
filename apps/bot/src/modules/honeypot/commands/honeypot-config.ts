import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type Guild } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { ACTION_CHOICES, ACTION_LABELS, getHoneypotConfig, invalidateHoneypotConfig, type HoneypotAction } from "../config.js";

function missingPermissions(guild: Guild, action: HoneypotAction): string[] {
  const me = guild.members.me;
  if (!me) return [];
  const missing: string[] = [];
  if (!me.permissions.has(PermissionFlagsBits.ManageMessages)) missing.push("Manage Messages (to delete the trap message)");
  if ((action === "ban" || action === "softban") && !me.permissions.has(PermissionFlagsBits.BanMembers)) missing.push("Ban Members");
  if (action === "kick" && !me.permissions.has(PermissionFlagsBits.KickMembers)) missing.push("Kick Members");
  if (action === "timeout" && !me.permissions.has(PermissionFlagsBits.ModerateMembers)) missing.push("Timeout Members");
  return missing;
}

export const honeypotConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("honeypot-config")
    .setDescription("View or change honeypot settings. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn the honeypot on or off"))
    .addStringOption((o) => o.setName("action").setDescription("What happens to anyone who writes in the trap channel").addChoices(...ACTION_CHOICES))
    .addIntegerOption((o) =>
      o.setName("delete_message_hours").setDescription("On ban/soft-ban, delete the user's messages from this many hours back (0-168)").setMinValue(0).setMaxValue(168),
    )
    .addChannelOption((o) => o.setName("log_channel").setDescription("Channel for honeypot logs").addChannelTypes(ChannelType.GuildText))
    .addRoleOption((o) => o.setName("ignore_role").setDescription("Add a role that is never punished"))
    .addRoleOption((o) => o.setName("unignore_role").setDescription("Remove a role from the ignore list")),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const o = interaction.options;
    const current = await getHoneypotConfig(guild.id);

    const hours = o.getInteger("delete_message_hours");
    const ignore = o.getRole("ignore_role");
    const unignore = o.getRole("unignore_role");
    let ignoredRoleIds = current.ignoredRoleIds;
    if (ignore) ignoredRoleIds = [...new Set([...ignoredRoleIds, ignore.id])];
    if (unignore) ignoredRoleIds = ignoredRoleIds.filter((id) => id !== unignore.id);

    const data = {
      ...(o.getBoolean("enabled") !== null && { enabled: o.getBoolean("enabled")! }),
      ...(o.getString("action") && { action: o.getString("action")! }),
      ...(hours !== null && { deleteMessageSeconds: hours * 3600 }),
      ...(o.getChannel("log_channel") && { logChannelId: o.getChannel("log_channel")!.id }),
      ...((ignore || unignore) && { ignoredRoleIds }),
    };
    const touched = Object.keys(data).length > 0;
    if (touched) {
      await prisma.honeypotSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
      invalidateHoneypotConfig(guild.id);
    }

    const c = await getHoneypotConfig(guild.id);
    const body = [
      `**Honeypot:** ${c.enabled ? "on" : "off"}`,
      `**Channel:** ${c.channelId ? `<#${c.channelId}>` : "not set (use `/honeypot-setup`)"}`,
      `**Action:** ${ACTION_LABELS[c.action]}`,
      `**Delete messages from:** the last ${c.deleteMessageSeconds / 3600} hour(s) (ban and soft-ban only)`,
      `**Ignored roles:** ${c.ignoredRoleIds.length ? c.ignoredRoleIds.map((id) => `<@&${id}>`).join(", ") : "none"}`,
      `**Log channel:** ${c.logChannelId ? `<#${c.logChannelId}>` : "not set"}`,
    ].join("\n");

    const container = touched ? notice.success(body, "Honeypot settings updated") : panel({ title: "Honeypot settings", body });
    const warnings: string[] = [];
    if (c.enabled && !c.channelId) warnings.push("The honeypot is on, but no channel is set. Run `/honeypot-setup`.");
    for (const perm of missingPermissions(guild, c.action)) warnings.push(`I'm missing the **${perm}** permission.`);
    for (const w of warnings) container.addTextDisplayComponents(callout.warning(w));
    await interaction.reply(v2Ephemeral(container));
  },
});
