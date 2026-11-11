/**
 * YouTubeのRSSフィード(APIキー不要・利用上限なし)の取得と解析。
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxxx
 */

export interface FeedVideo {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  thumbnailUrl: string;
}

export interface Feed {
  channelId: string;
  channelName: string;
  videos: FeedVideo[]; // 新しい順
}

export class FeedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const USER_AGENT = "Mozilla/5.0 (compatible; LumiiBot/1.0)";
const CHANNEL_ID = /UC[\w-]{22}/;

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const pick = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? null;

export function parseFeed(xml: string, channelId: string): Feed {
  const entries = xml.split("<entry>").slice(1);
  const head = xml.split("<entry>")[0] ?? "";

  const videos: FeedVideo[] = [];
  for (const entry of entries) {
    const id = pick(entry, "yt:videoId");
    const title = pick(entry, "title");
    const published = pick(entry, "published");
    if (!id || !title || !published) continue;
    const publishedAt = new Date(published);
    if (Number.isNaN(publishedAt.getTime())) continue;

    videos.push({
      id,
      title: decodeEntities(title),
      url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  videos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const author = pick(head, "name") ?? pick(head, "title") ?? channelId;
  return { channelId, channelName: decodeEntities(author), videos };
}

export async function fetchFeed(channelId: string): Promise<Feed> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    throw new FeedError(`Could not reach YouTube: ${err instanceof Error ? err.message : err}`);
  });

  if (res.status === 404) throw new FeedError("That YouTube channel was not found.", 404);
  if (!res.ok) throw new FeedError(`YouTube returned HTTP ${res.status}.`, res.status);
  return parseFeed(await res.text(), channelId);
}

/**
 * ユーザーが入力した文字列から、YouTubeのチャンネルID(UC...)を取り出す。
 * 対応: チャンネルID / youtube.com/channel/UC... / @ハンドル / youtube.com/@ハンドル / /c/名前 / /user/名前
 */
export async function resolveChannelId(input: string): Promise<string | null> {
  const text = input.trim();
  if (new RegExp(`^${CHANNEL_ID.source}$`).test(text)) return text;

  const direct = text.match(new RegExp(`youtube\\.com/channel/(${CHANNEL_ID.source})`, "i"));
  if (direct) return direct[1]!;

  let url: string | null = null;
  if (/^@[\w.\-%]+$/.test(text)) url = `https://www.youtube.com/${text}`;
  else {
    const m = text.match(/youtube\.com\/(@[\w.\-%]+|c\/[\w.\-%]+|user\/[\w.\-%]+)/i);
    if (m) url = `https://www.youtube.com/${m[1]}`;
  }
  if (!url) return null;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", Cookie: "SOCS=CAI; CONSENT=YES+cb" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;

  return extractChannelIdFromHtml(await res.text());
}

/** チャンネルページのHTMLからID(UC...)を探す。そのページ自身を示す項目を優先する。 */
export function extractChannelIdFromHtml(html: string): string | null {
  const patterns = [
    new RegExp(`<link rel="canonical" href="https://www\\.youtube\\.com/channel/(${CHANNEL_ID.source})"`),
    new RegExp(`itemprop="identifier" content="(${CHANNEL_ID.source})"`),
    new RegExp(`"externalId":"(${CHANNEL_ID.source})"`),
    new RegExp(`channel_id=(${CHANNEL_ID.source})`),
    new RegExp(`"channelId":"(${CHANNEL_ID.source})"`),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1]!;
  }
  return null;
}
