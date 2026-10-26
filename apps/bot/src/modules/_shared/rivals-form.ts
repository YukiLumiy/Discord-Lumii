import {
  ActionRowBuilder,
  ContainerBuilder,
  ModalBuilder,
  SectionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
  type ModalSubmitInteraction,
  type User,
} from "discord.js";
import { COLORS, divider, text } from "../../core/panel.js";

/**
 * ClanJoin と Looking for Playing で共通の入力フォーム(Roblox Rivals向け)。
 * ※ Discordの仕様で、モーダルの質問文(label)は45文字以内。
 */

const FIELD = { username: "username", level: "level", kills: "kills", social: "social" } as const;

export function buildRivalsModal(customId: string, title: string): ModalBuilder {
  const row = (input: TextInputBuilder) => new ActionRowBuilder<TextInputBuilder>().addComponents(input);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.username)
          .setLabel("What is your Roblox username?")
          .setPlaceholder("@YukiLumiy")
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(21) // 先頭の@ + Robloxの最大20文字
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.level)
          .setLabel("What is your level?")
          .setPlaceholder("e.g. 120")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(6)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.kills)
          .setLabel("How many All Weapons kills do you have?")
          .setPlaceholder("e.g. 5000")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(9)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.social)
          .setLabel("TikTok or YouTube username? (optional)")
          .setPlaceholder("@yourname")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false),
      ),
    );
}

export interface RivalsAnswers {
  username: string;
  level: number;
  kills: number;
  social: string | null;
}

export type ParseResult = { ok: true; answers: RivalsAnswers } | { ok: false; error: string };

const toInt = (raw: string): number | null => {
  const cleaned = raw.replace(/[,\s]/g, "");
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
};

export function parseRivalsModal(i: ModalSubmitInteraction): ParseResult {
  const username = i.fields.getTextInputValue(FIELD.username).trim().replace(/^@/, "");
  // Robloxのユーザー名: 英数字とアンダースコアのみ、3〜20文字
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return { ok: false, error: "That doesn't look like a valid Roblox username (3–20 letters, numbers or `_`)." };
  }

  const level = toInt(i.fields.getTextInputValue(FIELD.level));
  if (level === null || level < 1) return { ok: false, error: "Level must be a whole number (1 or higher)." };

  const kills = toInt(i.fields.getTextInputValue(FIELD.kills));
  if (kills === null) return { ok: false, error: "Kills must be a whole number (0 or higher)." };

  const social = i.fields.getTextInputValue(FIELD.social).trim();

  return { ok: true, answers: { username, level, kills, social: social || null } };
}

/** 申請/募集の内容を表示するパネル(送信者のアイコン付き) */
export function applicantPanel(opts: { title: string; intro: string; user: User; answers: RivalsAnswers }): ContainerBuilder {
  const { answers: a, user } = opts;
  const lines = [
    `**Roblox:** [@${a.username}](https://www.roblox.com/search/users?keyword=${encodeURIComponent(a.username)})`,
    `**Level:** ${a.level.toLocaleString("en-US")}`,
    `**All Weapons kills:** ${a.kills.toLocaleString("en-US")}`,
    `**TikTok / YouTube:** ${a.social ?? "—"}`,
  ].join("\n");

  const header = new SectionBuilder()
    .addTextDisplayComponents(text(`## ${opts.title}`), text(opts.intro))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })));

  return new ContainerBuilder()
    .setAccentColor(COLORS.ruby)
    .addSectionComponents(header)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(lines))
    .addTextDisplayComponents(text(`-# Submitted <t:${Math.floor(Date.now() / 1000)}:R>`));
}
