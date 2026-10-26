import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { notice, panel, v2Ephemeral } from "../../../core/panel.js";
import { getLevelConfig, invalidateLevelCaches } from "../settings.js";

export const levelConfig = defineCommand({
  data: new SlashCommandBuilder()
    .setName("level-config")
    .setDescription("View or change the leveling settings. Run with no options to see the current settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName("enabled").setDescription("Turn leveling on or off"))
    .addIntegerOption((o) => o.setName("xp_min").setDescription("Minimum XP per message").setMinValue(1).setMaxValue(1000))
    .addIntegerOption((o) => o.setName("xp_max").setDescription("Maximum XP per message").setMinValue(1).setMaxValue(1000))
    .addIntegerOption((o) => o.setName("cooldown_seconds").setDescription("Seconds between XP-earning messages (0 = none)").setMinValue(0).setMaxValue(3600))
    .addBooleanOption((o) => o.setName("levelup_enabled").setDescription("Send a level-up panel when members level up"))
    .addChannelOption((o) =>
      o.setName("levelup_channel").setDescription("Channel for level-up panels (default: the channel the member chatted in)").addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) =>
      o
        .setName("levelup_message")
        .setDescription("Level-up text. Placeholders: {user} {username} {level} {server}")
        .setMaxLength(500),
    )
    .addBooleanOption((o) => o.setName("stack_roles").setDescription("Keep all earned level roles (off = only the highest)")),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const o = interaction.options;
    const changes = {
      enabled: o.getBoolean("enabled"),
      xpMin: o.getInteger("xp_min"),
      xpMax: o.getInteger("xp_max"),
      cooldownSeconds: o.getInteger("cooldown_seconds"),
      levelUpEnabled: o.getBoolean("levelup_enabled"),
      levelUpChannelId: o.getChannel("levelup_channel")?.id ?? null,
      levelUpMessage: o.getString("levelup_message"),
      stackRoles: o.getBoolean("stack_roles"),
    };
    const touched = Object.values(changes).some((v) => v !== null);

    if (touched) {
      const current = await getLevelConfig(guildId);
      const min = changes.xpMin ?? current.xpMin;
      const max = changes.xpMax ?? current.xpMax;
      if (min > max) {
        await interaction.reply(v2Ephemeral(notice.error("`xp_min` can't be greater than `xp_max`.")));
        return;
      }

      // null(未指定)の項目は undefined にして更新対象から外す
      const data = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== null));
      await prisma.levelSettings.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
      invalidateLevelCaches(guildId);
    }

    const c = await getLevelConfig(guildId);
    const body = [
      `**Leveling:** ${c.enabled ? "on" : "off"}`,
      `**XP per message:** ${c.xpMin}–${c.xpMax} (cooldown ${c.cooldownSeconds}s)`,
      `**Level-up panel:** ${c.levelUpEnabled ? "on" : "off"} → ${c.levelUpChannelId ? `<#${c.levelUpChannelId}>` : "the channel the member chatted in"}`,
      `**Level-up text:** ${c.levelUpMessage}`,
      `**Level roles:** ${c.stackRoles ? "keep all earned roles" : "highest role only"}`,
    ].join("\n");

    const container = touched ? notice.success(body, "Leveling settings updated") : panel({ title: "Leveling settings", body });
    await interaction.reply(v2Ephemeral(container));
  },
});
