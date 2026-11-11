import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type Guild } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { ACTION_LABELS, getAntiRaidConfig, invalidateAntiRaidConfig, type RaidAction } from "../config.js";
import { getLockdownUntil } from "../service.js";

/** 選んだ動作と設定に必要な権限が、Botに付いているかを確認する */
function missingPermissions(guild: Guild, action: RaidAction, kicksYoungAccounts: boolean): string[] {
  const me = guild.members.me;
  if (!me) return [];
  const missing: string[] = [];
  if (action === "lockdown" && !me.permissions.has(PermissionFlagsBits.ManageGuild)) missing.push("Manage Server (needed to change the verification level)");
  if ((action === "kick" || kicksYoungAccounts) && !me.permissions.has(PermissionFlagsBits.KickMembers)) missing.push("Kick Members");
  if (action === "ban" && !me.permissions.has(PermissionFlagsBits.BanMembers)) missing.push("Ban Members");
  return missing;
}

export const antiRaidConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("antiraid-config")
    .setDescription("View or change Anti Raid settings. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn Anti Raid on or off"))
    .addIntegerOption((o) => o.setName("join_threshold").setDescription("Number of joins that counts as a raid").setMinValue(2).setMaxValue(200))
    .addIntegerOption((o) => o.setName("join_window_seconds").setDescription("Time window for counting joins, in seconds").setMinValue(3).setMaxValue(600))
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("What to do when a raid is detected")
        .addChoices(
          { name: "Alert only (log, no action)", value: "alert" },
          { name: "Lockdown (raise verification level)", value: "lockdown" },
          { name: "Kick the raiders", value: "kick" },
          { name: "Ban the raiders", value: "ban" },
        ),
    )
    .addIntegerOption((o) => o.setName("min_account_age_days").setDescription("Kick accounts younger than this many days (0 = off)").setMinValue(0).setMaxValue(365))
    .addIntegerOption((o) => o.setName("lockdown_minutes").setDescription("Minutes after the last raid join before lockdown ends").setMinValue(1).setMaxValue(240))
    .addChannelOption((o) => o.setName("log_channel").setDescription("Channel for security logs").addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const o = interaction.options;

    const enabled = o.getBoolean("enabled");
    const threshold = o.getInteger("join_threshold");
    const windowSeconds = o.getInteger("join_window_seconds");
    const action = o.getString("action");
    const minAge = o.getInteger("min_account_age_days");
    const lockdownMinutes = o.getInteger("lockdown_minutes");
    const logChannel = o.getChannel("log_channel");

    const data = {
      ...(enabled !== null && { enabled }),
      ...(threshold !== null && { joinThreshold: threshold }),
      ...(windowSeconds !== null && { joinWindowSeconds: windowSeconds }),
      ...(action !== null && { action }),
      ...(minAge !== null && { minAccountAgeDays: minAge }),
      ...(lockdownMinutes !== null && { lockdownMinutes }),
      ...(logChannel && { logChannelId: logChannel.id }),
    };
    const touched = Object.keys(data).length > 0;
    if (touched) {
      await prisma.antiRaidSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });
      invalidateAntiRaidConfig(guild.id);
    }

    const c = await getAntiRaidConfig(guild.id);
    const lockdownUntil = await getLockdownUntil(guild.id);

    const body = [
      `**Anti Raid:** ${c.enabled ? "on" : "off"}`,
      `**Raid detection:** ${c.joinThreshold} joins within ${c.joinWindowSeconds}s`,
      `**Action:** ${ACTION_LABELS[c.action]}`,
      `**Young accounts:** ${c.minAccountAgeDays > 0 ? `kick accounts younger than ${c.minAccountAgeDays} days` : "off"}`,
      `**Lockdown length:** ${c.lockdownMinutes} min after the last raid join`,
      `**Log channel:** ${c.logChannelId ? `<#${c.logChannelId}>` : "not set"}`,
      lockdownUntil ? `**Lockdown:** active, ends <t:${Math.floor(lockdownUntil.getTime() / 1000)}:R>` : null,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    const container = touched ? notice.success(body, "Anti Raid settings updated") : panel({ title: "Anti Raid settings", body });

    const warnings: string[] = [];
    if (c.enabled && !c.logChannelId) warnings.push("No log channel is set, so you won't be told when a raid is detected. Set one with `log_channel`.");
    for (const perm of missingPermissions(guild, c.action, c.minAccountAgeDays > 0)) warnings.push(`I'm missing the **${perm}** permission.`);
    if (c.action === "ban" || c.action === "kick") {
      warnings.push(`A large legitimate wave of joins (for example after a big announcement) can also trigger the **${c.action}** action. Use **alert** first to tune the threshold.`);
    }
    for (const w of warnings) container.addTextDisplayComponents(callout.warning(w));

    await interaction.reply(v2Ephemeral(container));
  },
});
