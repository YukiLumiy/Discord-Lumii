import { ContainerBuilder, SectionBuilder, ThumbnailBuilder, type Client } from "discord.js";
import { COLORS, divider, text, v2 } from "../../core/panel.js";
import { getLogChannels, type LogCategory } from "./config.js";

/** ログ用パネル。ユーザーのアイコンがあれば右上に表示し、末尾に発生時刻を付ける。 */
export function logPanel(opts: { title: string; lines: (string | null | undefined)[]; color?: number; thumbnailUrl?: string }): ContainerBuilder {
  const body = opts.lines.filter((l): l is string => Boolean(l)).join("\n");
  const c = new ContainerBuilder().setAccentColor(opts.color ?? COLORS.neutral);

  if (opts.thumbnailUrl) {
    c.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(text(`## ${opts.title}`), text(body)).setThumbnailAccessory(new ThumbnailBuilder().setURL(opts.thumbnailUrl)),
    );
  } else {
    c.addTextDisplayComponents(text(`## ${opts.title}\n\n${body}`));
  }
  return c.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# <t:${Math.floor(Date.now() / 1000)}:f>`));
}

/** そのカテゴリの送信先が設定されていればパネルを送る(未設定なら何もしない)。 */
export async function sendLog(client: Client, guildId: string, category: LogCategory, container: ContainerBuilder): Promise<void> {
  const channelId = (await getLogChannels(guildId))[category];
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId) ?? (await client.channels.fetch(channelId).catch(() => null));
  if (!channel?.isSendable()) return;
  await channel.send(v2(container)).catch((err) => console.error(`[logs] failed to send ${category} log in ${guildId}`, err));
}

/** メッセージ本文をログ用に整える。マークダウンやリンクが効かないようコードブロックに入れる。 */
export function codeBlock(content: string | null | undefined, max = 900): string {
  if (!content) return "*no text*";
  const clean = content.replace(/```/g, "'''");
  return `\`\`\`\n${clean.length > max ? `${clean.slice(0, max)}...` : clean}\n\`\`\``;
}

export const mention = (id: string | null | undefined) => (id ? `<@${id}>` : "unknown");
export const timeAgo = (ms: number | null | undefined) => (ms ? `<t:${Math.floor(ms / 1000)}:R>` : "unknown");
