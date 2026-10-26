import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } from "discord.js";
import { COLORS, CREDIT, divider, text } from "../../core/panel.js";

/** パネルの表示に必要な項目(DBの Giveaway から抜き出したもの) */
export interface GiveawayView {
  id: string;
  hostId: string;
  prize: string;
  description: string | null;
  imageName: string | null;
  winnerCount: number;
  endsAt: Date;
  cancelled: boolean;
  ended: boolean;
  winnerIds: string[];
  requiredRoleId: string | null;
  blacklistRoleId: string | null;
  minAccountAgeDays: number | null;
  minLevel: number | null;
  bonusRoleId: string | null;
  bonusEntries: number;
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** 参加条件を引用ブロックの行にする(条件が無ければ null) */
function requirementLines(g: GiveawayView): string | null {
  const lines: string[] = [];
  if (g.requiredRoleId) lines.push(`> Required role: <@&${g.requiredRoleId}>`);
  if (g.blacklistRoleId) lines.push(`> Excluded role: <@&${g.blacklistRoleId}>`);
  if (g.minLevel) lines.push(`> Minimum level: **${g.minLevel}**`);
  if (g.minAccountAgeDays) lines.push(`> Minimum account age: **${g.minAccountAgeDays}** days`);
  if (g.bonusRoleId) lines.push(`> Bonus: <@&${g.bonusRoleId}> gets **${g.bonusEntries}** entries`);
  return lines.length ? `### Requirements\n${lines.join("\n")}` : null;
}

/**
 * 抽選パネル。開催中は「Enter」ボタン付き、終了・中止後はボタン無し。
 * 画像は最初のメッセージに添付済みなので attachment://<imageName> で参照する。
 */
export function buildGiveawayPanel(g: GiveawayView, entryCount: number): ContainerBuilder {
  const state = g.cancelled ? "cancelled" : g.ended ? "ended" : "active";
  const color = state === "active" ? COLORS.ruby : state === "cancelled" ? COLORS.danger : COLORS.neutral;
  const c = new ContainerBuilder().setAccentColor(color);

  const headLines = [`## ${g.prize}`];
  if (state === "cancelled") headLines.push("**This giveaway was cancelled.**");
  if (g.description) headLines.push(g.description);
  c.addTextDisplayComponents(text(headLines.join("\n\n")));

  if (g.imageName) {
    c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${g.imageName}`)));
  }

  c.addSeparatorComponents(divider());

  const details = [
    `**Hosted by:** <@${g.hostId}>`,
    state === "active" ? `**Ends:** <t:${unix(g.endsAt)}:R> (<t:${unix(g.endsAt)}:f>)` : `**Ended:** <t:${unix(g.endsAt)}:f>`,
    `**Winners:** ${g.winnerCount}`,
    `**Entries:** ${entryCount.toLocaleString("en-US")}`,
  ];
  if (state === "ended" && g.winnerIds.length > 0) details.push(`**Winner${g.winnerIds.length > 1 ? "s" : ""}:** ${g.winnerIds.map((id) => `<@${id}>`).join(", ")}`);
  if (state === "ended" && g.winnerIds.length === 0) details.push("**Winner:** none (no valid entries)");
  c.addTextDisplayComponents(text(details.join("\n")));

  const requirements = requirementLines(g);
  if (requirements) c.addTextDisplayComponents(text(requirements));

  if (state === "active") {
    c.addSeparatorComponents(divider());
    c.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`giveaway:enter:${g.id}`).setLabel("Enter Giveaway").setStyle(ButtonStyle.Primary),
      ),
    );
  }

  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text(`-# ${CREDIT}`));
  return c;
}

/** 当選発表のパネル(新しいメッセージとして送る) */
export function buildWinnersPanel(opts: { prize: string; winnerIds: string[]; url: string; reroll?: boolean }): ContainerBuilder {
  const mentions = opts.winnerIds.map((id) => `<@${id}>`).join(", ");
  const body = [
    `## ${opts.reroll ? "New winner drawn" : "Giveaway ended"}`,
    `**Prize:** ${opts.prize}`,
    `**Winner${opts.winnerIds.length > 1 ? "s" : ""}:** ${mentions}`,
    `Congratulations. [View the giveaway](${opts.url})`,
  ].join("\n\n");
  return new ContainerBuilder().setAccentColor(COLORS.success).addTextDisplayComponents(text(body));
}
