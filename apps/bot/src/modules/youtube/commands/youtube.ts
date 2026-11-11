import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../../../core/types.js";
import { callout, notice, panel, v2, v2Ephemeral } from "../../../core/panel.js";
import { resolveChannelId } from "../feed.js";
import { DEFAULT_MESSAGE } from "../panels.js";
import { addSubscription, listGuildSubscriptions, MAX_SUBSCRIPTIONS_PER_GUILD, removeSubscription } from "../service.js";

export const youtube = defineCommand({
  data: new SlashCommandBuilder()
    .setName("youtube")
    .setDescription("Get a notification when a YouTube channel uploads a new video.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Track a YouTube channel.")
        .addStringOption((o) => o.setName("channel").setDescription("Channel ID (UC...), @handle, or the channel's URL").setRequired(true))
        .addChannelOption((o) =>
          o.setName("notify_channel").setDescription("Where to post new videos").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        )
        .addRoleOption((o) => o.setName("mention_role").setDescription("Role to mention with each notification"))
        .addStringOption((o) =>
          o.setName("message").setDescription(`Custom text. Placeholders: {channel} {title} {url}`).setMaxLength(300),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Stop tracking a YouTube channel.")
        .addStringOption((o) => o.setName("channel").setDescription("Pick a tracked channel").setAutocomplete(true).setRequired(true)),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Show the tracked YouTube channels.")),

  async autocomplete(interaction) {
    if (!interaction.guildId) return;
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = listGuildSubscriptions(interaction.guildId)
      .filter((s) => s.youtubeChannelName.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((s) => ({ name: s.youtubeChannelName.slice(0, 100), value: s.id }));
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const subs = listGuildSubscriptions(guild.id);
      if (subs.length === 0) {
        await interaction.reply(v2Ephemeral(notice.info("No YouTube channels are tracked yet. Add one with `/youtube add`.", "YouTube notifications")));
        return;
      }
      const lines = subs.map(
        (s) =>
          `**${s.youtubeChannelName}**\n> Posts in <#${s.discordChannelId}>${s.mentionRoleId ? ` and mentions <@&${s.mentionRoleId}>` : ""}\n> [Open channel](https://www.youtube.com/channel/${s.youtubeChannelId})`,
      );
      await interaction.reply(v2Ephemeral(panel({ title: `YouTube notifications (${subs.length}/${MAX_SUBSCRIPTIONS_PER_GUILD})`, body: lines.join("\n\n") })));
      return;
    }

    if (sub === "remove") {
      const removed = await removeSubscription(guild.id, interaction.options.getString("channel", true));
      await interaction.reply(
        v2Ephemeral(removed ? notice.success(`Stopped tracking **${removed.youtubeChannelName}**.`, "Removed") : notice.error("I couldn't find that channel. Pick one from the list.")),
      );
      return;
    }

    // add: ハンドルの解決とフィードの確認で数秒かかることがあるので、先に応答を保留する
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const youtubeChannelId = await resolveChannelId(interaction.options.getString("channel", true));
    if (!youtubeChannelId) {
      await interaction.editReply(
        v2(notice.error("I couldn't find that channel. Use the channel ID (starts with `UC`), a `@handle`, or a channel URL such as `https://www.youtube.com/@name`.", "Channel not found")),
      );
      return;
    }

    const notifyChannel = interaction.options.getChannel("notify_channel", true);
    const result = await addSubscription({
      guildId: guild.id,
      youtubeChannelId,
      discordChannelId: notifyChannel.id,
      mentionRoleId: interaction.options.getRole("mention_role")?.id ?? null,
      message: interaction.options.getString("message"),
    });

    if (!result.ok) {
      await interaction.editReply(v2(notice.error(result.reason, "Couldn't add the channel")));
      return;
    }

    const done = notice.success(
      [`**YouTube channel:** ${result.subscription.youtubeChannelName}`, `**Posts in:** <#${notifyChannel.id}>`, "New videos are checked every 10 minutes."].join("\n"),
      "Now tracking",
    );
    const me = guild.members.me;
    const target = guild.channels.cache.get(notifyChannel.id);
    if (me && target && !target.permissionsFor(me).has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel)) {
      done.addTextDisplayComponents(callout.warning(`I can't send messages in <#${notifyChannel.id}>. Allow it, or notifications won't appear.`));
    }
    done.addTextDisplayComponents(callout.tip(`Videos uploaded before now are not announced. Default text: ${DEFAULT_MESSAGE}`));
    await interaction.editReply(v2(done));
  },
});
