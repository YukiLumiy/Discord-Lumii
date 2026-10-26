import { MessageFlags, AttachmentBuilder, ChannelType, type ChatInputCommandInteraction } from "discord.js";
import { prisma } from "@lumii/database";
import { text, v2, notice, v2Ephemeral } from "../../../core/panel.js";
import { parseDuration } from "../../../core/duration.js";
import { buildGiveawayPanel, type GiveawayView } from "../panels.js";

const MIN_DURATION_MS = 60_000;
const MAX_DURATION_MS = 90 * 86_400_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function startGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const o = interaction.options;

  const durationMs = parseDuration(o.getString("duration", true));
  if (durationMs === null || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    await interaction.reply(v2Ephemeral(notice.error("Use a duration between **1 minute** and **90 days**, such as `30m`, `2h`, `1d` or `1h30m`.", "Invalid duration")));
    return;
  }

  const target = o.getChannel("channel") ?? interaction.channel;
  const channel = target ? await guild.channels.fetch(target.id).catch(() => null) : null;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply(v2Ephemeral(notice.error("The giveaway channel must be a text channel.")));
    return;
  }

  // 画像は一度ダウンロードして、メッセージに添付し直す(DiscordのCDNリンクは期限切れになるため)
  const image = o.getAttachment("image");
  let file: AttachmentBuilder | null = null;
  let imageName: string | null = null;
  if (image) {
    if (!image.contentType?.startsWith("image/") || image.size > MAX_IMAGE_BYTES) {
      await interaction.reply(v2Ephemeral(notice.error("The image must be an image file under 8 MB.", "Invalid image")));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = await fetch(image.url).catch(() => null);
    if (!res?.ok) {
      await interaction.editReply(v2(notice.error("I couldn't download that image. Try a different one.")));
      return;
    }
    const extension = image.contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
    imageName = `giveaway.${extension}`;
    file = new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: imageName });
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const host = o.getUser("host") ?? interaction.user;
  const bonusRole = o.getRole("bonus_role");
  const pingRole = o.getRole("ping_role");

  const created = await prisma.giveaway.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      hostId: host.id,
      prize: o.getString("prize", true),
      description: o.getString("description"),
      imageName,
      winnerCount: o.getInteger("winners") ?? 1,
      endsAt: new Date(Date.now() + durationMs),
      requiredRoleId: o.getRole("required_role")?.id ?? null,
      blacklistRoleId: o.getRole("blacklist_role")?.id ?? null,
      minAccountAgeDays: o.getInteger("min_account_age"),
      minLevel: o.getInteger("min_level"),
      bonusRoleId: bonusRole?.id ?? null,
      bonusEntries: o.getInteger("bonus_entries") ?? 2,
      pingRoleId: pingRole?.id ?? null,
      winnersRoleId: o.getRole("winners_role")?.id ?? null,
    },
  });

  try {
    const components = [
      ...(pingRole ? [text(`<@&${pingRole.id}>`)] : []),
      buildGiveawayPanel(created as GiveawayView, 0),
    ];
    const message = await channel.send({
      ...v2(...components),
      files: file ? [file] : [],
      allowedMentions: { roles: pingRole ? [pingRole.id] : [] },
    });
    await prisma.giveaway.update({ where: { id: created.id }, data: { messageId: message.id } });

    await interaction.editReply(
      v2(notice.success(`**${created.prize}** is live in <#${channel.id}>.\nIt ends <t:${Math.floor(created.endsAt.getTime() / 1000)}:R>.`, "Giveaway started")),
    );
  } catch (err) {
    // 送信できなかった場合は、中途半端なデータが残らないよう削除する
    await prisma.giveaway.delete({ where: { id: created.id } }).catch(() => undefined);
    console.error("[giveaways] failed to post giveaway", err);
    await interaction.editReply(v2(notice.error(`I couldn't post in <#${channel.id}>. Check that I can view and send messages there.`)));
  }
}
