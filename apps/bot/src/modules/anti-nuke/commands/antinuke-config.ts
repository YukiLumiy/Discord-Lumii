import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type Guild } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { PUNISHMENT_LABELS, getAntiNukeConfig, invalidateAntiNukeConfig, type NukePunishment } from "../config.js";

function missingPermissions(guild: Guild, punishment: NukePunishment): string[] {
  const me = guild.members.me;
  if (!me) return [];
  const missing: string[] = [];
  // 監査ログのイベントを受け取るには「監査ログを表示」が必要
  if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) missing.push("View Audit Log (needed to see who performed an action)");
  if (punishment === "removeRoles" && !me.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push("Manage Roles");
  if (punishment === "kick" && !me.permissions.has(PermissionFlagsBits.KickMembers)) missing.push("Kick Members");
  if (punishment === "ban" && !me.permissions.has(PermissionFlagsBits.BanMembers)) missing.push("Ban Members");
  return missing;
}

export const antiNukeConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("antinuke-config")
    .setDescription("View or change Anti Nuke settings. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn Anti Nuke on or off"))
    .addIntegerOption((o) => o.setName("max_channel_deletes").setDescription("Channel deletions that trigger it").setMinValue(1).setMaxValue(50))
    .addIntegerOption((o) => o.setName("max_role_deletes").setDescription("Role deletions that trigger it").setMinValue(1).setMaxValue(50))
    .addIntegerOption((o) => o.setName("max_bans").setDescription("Bans that trigger it").setMinValue(2).setMaxValue(100))
    .addIntegerOption((o) => o.setName("max_kicks").setDescription("Kicks that trigger it").setMinValue(2).setMaxValue(100))
    .addIntegerOption((o) => o.setName("window_seconds").setDescription("Time window for counting, in seconds").setMinValue(5).setMaxValue(300))
    .addStringOption((o) =>
      o
        .setName("punishment")
        .setDescription("What happens to the member who triggers it")
        .addChoices(
          { name: "Remove all of their roles", value: "removeRoles" },
          { name: "Kick them", value: "kick" },
          { name: "Ban them", value: "ban" },
        ),
    )
    .addChannelOption((o) => o.setName("log_channel").setDescription("Channel for security logs").addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const o = interaction.options;

    const data = {
      ...(o.getBoolean("enabled") !== null && { enabled: o.getBoolean("enabled")! }),
      ...(o.getInteger("max_channel_deletes") !== null && { maxChannelDeletes: o.getInteger("max_channel_deletes")! }),
      ...(o.getInteger("max_role_deletes") !== null && { maxRoleDeletes: o.getInteger("max_role_deletes")! }),
      ...(o.getInteger("max_bans") !== null && { maxBans: o.getInteger("max_bans")! }),
      ...(o.getInteger("max_kicks") !== null && { maxKicks: o.getInteger("max_kicks")! }),
      ...(o.getInteger("window_seconds") !== null && { windowSeconds: o.getInteger("window_seconds")! }),
      ...(o.getString("punishment") && { punishment: o.getString("punishment")! }),
      ...(o.getChannel("log_channel") && { logChannelId: o.getChannel("log_channel")!.id }),
    };
    const touched = Object.keys(data).length > 0;
    if (touched) {
      await prisma.antiNukeSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
      invalidateAntiNukeConfig(guild.id);
    }

    const c = await getAntiNukeConfig(guild.id);
    const body = [
      `**Anti Nuke:** ${c.enabled ? "on" : "off"}`,
      `**Limits** (within ${c.windowSeconds}s):`,
      `> Channel deletions: **${c.limits.channel}**`,
      `> Role deletions: **${c.limits.role}**`,
      `> Bans: **${c.limits.ban}**`,
      `> Kicks: **${c.limits.kick}**`,
      `**Punishment:** ${PUNISHMENT_LABELS[c.punishment]}`,
      `**Log channel:** ${c.logChannelId ? `<#${c.logChannelId}>` : "not set"}`,
      `**Whitelist:** ${c.whitelistedUserIds.length} user${c.whitelistedUserIds.length === 1 ? "" : "s"}, ${c.whitelistedRoleIds.length} role${c.whitelistedRoleIds.length === 1 ? "" : "s"} (manage with \`/antinuke-whitelist\`)`,
    ].join("\n");

    const container = touched ? notice.success(body, "Anti Nuke settings updated") : panel({ title: "Anti Nuke settings", body });
    container.addTextDisplayComponents(callout.tip("The server owner and Lumii are always exempt. Whitelist your trusted moderators and moderation bots so normal work doesn't trigger it."));

    const warnings: string[] = [];
    if (c.enabled && !c.logChannelId) warnings.push("No log channel is set, so you won't be told when it triggers. Set one with `log_channel`.");
    for (const perm of missingPermissions(guild, c.punishment)) warnings.push(`I'm missing the **${perm}** permission.`);
    warnings.push("I can only punish members whose highest role is below mine. Keep my role near the top of the role list.");
    for (const w of warnings) container.addTextDisplayComponents(callout.warning(w));

    await interaction.reply(v2Ephemeral(container));
  },
});
