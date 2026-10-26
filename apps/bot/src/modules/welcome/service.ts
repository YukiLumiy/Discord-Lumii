import { SectionBuilder, ThumbnailBuilder, ContainerBuilder } from "discord.js";
import { prisma } from "@lumii/database";
import { COLORS, divider, text } from "../../core/panel.js";

export const DEFAULT_WELCOME_MESSAGE = "Welcome to **{server}**, {user}! We're glad you're here.";
export const DEFAULT_LEAVE_MESSAGE = "**{username}** has left the server.";

export interface WelcomeConfig {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string | null;
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null> {
  const row = await prisma.welcomeSettings.findUnique({ where: { guildId } });
  if (!row) return null;
  return {
    welcomeEnabled: row.welcomeEnabled,
    welcomeChannelId: row.welcomeChannelId,
    welcomeMessage: row.welcomeMessage,
    leaveEnabled: row.leaveEnabled,
    leaveChannelId: row.leaveChannelId,
    leaveMessage: row.leaveMessage,
  };
}

export interface TemplateVars {
  userId: string;
  username: string;
  server: string;
  count: number;
}

/** {user} {username} {server} {count} を展開する */
export function renderTemplate(template: string, v: TemplateVars): string {
  return template
    .replaceAll("{user}", `<@${v.userId}>`)
    .replaceAll("{username}", v.username)
    .replaceAll("{server}", v.server)
    .replaceAll("{count}", v.count.toLocaleString("en-US"));
}

interface PanelOptions extends TemplateVars {
  avatarUrl: string;
  template: string | null;
  /** 退出パネルで「参加した日時」を出すためのUnix秒(不明なら省略) */
  joinedAtUnix?: number;
}

/** 参加メッセージのパネル(アイコン付き) */
export function buildWelcomePanel(o: PanelOptions): ContainerBuilder {
  const header = new SectionBuilder()
    .addTextDisplayComponents(
      text("## Welcome!"),
      text(renderTemplate(o.template ?? DEFAULT_WELCOME_MESSAGE, o)),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(o.avatarUrl));

  return new ContainerBuilder()
    .setAccentColor(COLORS.ruby)
    .addSectionComponents(header)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# Member #${o.count.toLocaleString("en-US")}`));
}

/** 退出メッセージのパネル */
export function buildLeavePanel(o: PanelOptions): ContainerBuilder {
  const header = new SectionBuilder()
    .addTextDisplayComponents(
      text("## Goodbye"),
      text(renderTemplate(o.template ?? DEFAULT_LEAVE_MESSAGE, o)),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(o.avatarUrl));

  const footer = [`Members: ${o.count.toLocaleString("en-US")}`];
  if (o.joinedAtUnix) footer.unshift(`Joined <t:${o.joinedAtUnix}:R>`);

  return new ContainerBuilder()
    .setAccentColor(COLORS.neutral)
    .addSectionComponents(header)
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${footer.join(" • ")}`));
}
