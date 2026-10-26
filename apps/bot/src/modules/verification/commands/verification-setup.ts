import { MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "@lumii/database";
import { defineCommand } from "../../../core/types.js";
import { addCredit, callout, notice, panel, v2, v2Ephemeral } from "../../../core/panel.js";
import { canBotAssignRole, ROLE_HIERARCHY_HINT } from "../../_shared/roles.js";

export const verificationSetup = defineCommand({
  data: new SlashCommandBuilder()
    .setName("verification-setup")
    .setDescription("Post the verification panel and choose the roles.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("panel_channel").setDescription("Channel to post the verification panel in").addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addRoleOption((o) => o.setName("verified_role").setDescription("Role given after verifying").setRequired(true))
    .addRoleOption((o) => o.setName("unverified_role").setDescription("Role given to new members until they verify (optional)")),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelChannel = await guild.channels.fetch(interaction.options.getChannel("panel_channel", true).id);
    if (panelChannel?.type !== ChannelType.GuildText) {
      await interaction.editReply(v2(notice.error("The panel channel must be a text channel.")));
      return;
    }
    const verified = interaction.options.getRole("verified_role", true);
    const unverified = interaction.options.getRole("unverified_role");

    // 以前のパネルがあれば削除して置き換える
    const prev = await prisma.verificationSettings.findUnique({ where: { guildId: guild.id } });
    if (prev?.panelChannelId && prev.panelMessageId) {
      const oldChannel = await guild.channels.fetch(prev.panelChannelId).catch(() => null);
      if (oldChannel?.isTextBased()) await oldChannel.messages.delete(prev.panelMessageId).catch(() => undefined);
    }

    const container = panel({
      title: "Verify to access this server",
      body: "Press the button below, then type the code you're shown to verify that you're human.",
    }).addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("verification:start").setLabel("Verify").setStyle(ButtonStyle.Success),
      ),
    );
    addCredit(container);
    const message = await panelChannel.send(v2(container));

    const data = {
      enabled: true,
      panelChannelId: panelChannel.id,
      panelMessageId: message.id,
      verifiedRoleId: verified.id,
      unverifiedRoleId: unverified?.id ?? null,
    };
    await prisma.verificationSettings.upsert({ where: { guildId: guild.id }, create: { guildId: guild.id, ...data }, update: data });

    const done = notice.success(
      [
        `Panel posted in ${panelChannel}.`,
        `**Verified role:** <@&${verified.id}>`,
        `**Unverified role:** ${unverified ? `<@&${unverified.id}>` : "none"}`,
      ].join("\n"),
      "Verification ready",
    );
    const unassignable = [verified.id, unverified?.id].filter((id): id is string => !!id).some((id) => !canBotAssignRole(guild, id));
    if (unassignable) done.addTextDisplayComponents(callout.warning(ROLE_HIERARCHY_HINT));
    done.addTextDisplayComponents(
      callout.tip("Hide your other channels from the unverified role (or from @everyone) so new members can only see the verification channel until they verify."),
    );
    await interaction.editReply(v2(done));
  },
});
