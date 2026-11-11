import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } from "discord.js";
import { COLORS, CREDIT, divider, text } from "../../core/panel.js";
import type { FeedVideo } from "./feed.js";

export const DEFAULT_MESSAGE = "**{channel}** just uploaded a new video.";

/** {channel} {title} {url} を展開する */
export function renderMessage(template: string | null, vars: { channel: string; title: string; url: string }): string {
  return (template ?? DEFAULT_MESSAGE).replaceAll("{channel}", vars.channel).replaceAll("{title}", vars.title).replaceAll("{url}", vars.url);
}

/** 新着動画の通知パネル(サムネイル + 動画へのリンクボタン) */
export function buildVideoPanel(opts: { channelName: string; message: string | null; video: FeedVideo }): ContainerBuilder {
  const { video } = opts;
  const unix = Math.floor(video.publishedAt.getTime() / 1000);
  const message = renderMessage(opts.message, { channel: opts.channelName, title: video.title, url: video.url });

  return new ContainerBuilder()
    .setAccentColor(COLORS.brand)
    .addTextDisplayComponents(text(`-# New upload\n## ${video.title}\n\n${message}`))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(video.thumbnailUrl)))
    .addTextDisplayComponents(text(`**Published:** <t:${unix}:R>`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Watch on YouTube").setStyle(ButtonStyle.Link).setURL(video.url)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${CREDIT}`));
}
