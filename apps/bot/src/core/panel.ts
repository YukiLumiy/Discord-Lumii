import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  type APIMessageTopLevelComponent,
  type JSONEncodable,
} from "discord.js";

/**
 * Lumiiが送るメッセージはすべてComponentsV2のパネル。
 * ComponentsV2のメッセージには content / embeds を付けられない点に注意。
 * 文字は TextDisplay、区切りは Separator、ボタンは ActionRow の中に Container ごと入れる。
 */

export const COLORS = {
  ruby: 0xe0115f, // ブランドカラー
  success: 0x57f287,
  danger: 0xed4245,
  neutral: 0x2b2d31,
} as const;

type Component = JSONEncodable<APIMessageTopLevelComponent>;

export const text = (markdown: string) => new TextDisplayBuilder().setContent(markdown);

export const divider = (spacing: SeparatorSpacingSize = SeparatorSpacingSize.Small) =>
  new SeparatorBuilder().setDivider(true).setSpacing(spacing);

/**
 * 見出し + 本文のパネル。Nyxと同じく「## 見出し」「空行」「本文」を1つのTextDisplayにまとめる。
 * ボタンなどを足したいときは戻り値の ContainerBuilder に追加し、最後に addCredit() を呼ぶ。
 */
export function panel(opts: { title?: string; body?: string; color?: number }): ContainerBuilder {
  const c = new ContainerBuilder().setAccentColor(opts.color ?? COLORS.ruby);
  const head = [opts.title ? `## ${opts.title}` : null, opts.body ?? null].filter((v): v is string => v !== null).join("\n\n");
  if (head) c.addTextDisplayComponents(text(head));
  return c;
}

/** 常設パネルの末尾に付けるクレジット行(区切り線 + サブテキスト)。ボタンの後に呼ぶ。 */
export const CREDIT = "Powered by **Lumii**";
export function addCredit(container: ContainerBuilder, line: string = CREDIT): ContainerBuilder {
  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# ${line}`));
}

/** 注意書き・ヒント(絵文字は使わず、太字のラベルで区別する) */
export const callout = {
  warning: (message: string) => text(`**Warning:** ${message}`),
  tip: (message: string) => text(`**Tip:** ${message}`),
};

/** channel.send() / message.edit() 用 */
export function v2(...containers: Component[]) {
  return { components: containers, flags: MessageFlags.IsComponentsV2 as const };
}

/** interaction.reply() 用(本人にだけ表示) */
export function v2Ephemeral(...containers: Component[]) {
  return {
    components: containers,
    flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as number,
  };
}

/** 成功/失敗などの短い通知パネル */
export const notice = {
  success: (body: string, title = "Success") => panel({ title, body, color: COLORS.success }),
  error: (body: string, title = "Error") => panel({ title, body, color: COLORS.danger }),
  info: (body: string, title?: string) => panel({ title, body, color: COLORS.ruby }),
};

/**
 * 画像つきパネル。画像は `files` に AttachmentBuilder で渡し、ここでは attachment://<name> で参照する。
 * @example
 *   panelWithImage({ title: "Rank", imageName: "rank.png", buttons: [refreshButton] })
 */
export function panelWithImage(opts: {
  title?: string;
  text?: string;
  imageName: string;
  buttons?: ButtonBuilder[];
  footer?: string;
  color?: number;
}): ContainerBuilder {
  const c = new ContainerBuilder().setAccentColor(opts.color ?? COLORS.ruby);
  const head = [opts.title ? `## ${opts.title}` : null, opts.text ?? null].filter((v): v is string => v !== null).join("\n\n");
  if (head) c.addTextDisplayComponents(text(head));
  c.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${opts.imageName}`)),
  );
  if (opts.buttons?.length) {
    c.addSeparatorComponents(divider());
    c.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...opts.buttons));
  }
  if (opts.footer) {
    c.addSeparatorComponents(divider());
    c.addTextDisplayComponents(text(`-# ${opts.footer}`));
  }
  return c;
}
