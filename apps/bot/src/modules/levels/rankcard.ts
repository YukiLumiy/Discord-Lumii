import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ensureFont, FONT } from "../_shared/fonts.js";

/** ランクカード / リーダーボード / レベルアップ画像の生成。 */

// apps/bot/{src|dist}/modules/levels → ../../.. = apps/bot
const logoPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../assets/images/lumii-logo.png");

const BG = "#0a0a0c";
const PANEL = "#141418";
const RUBY = "#e0115f";
const LINE = "#ffffff";
const TEXT = "#f5f5f7";
const MUTED = "#8d8d95";
const TRACK = "#25252b";

type Avatar = string | Buffer;

function roundedRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 白の細線で縁取った黒いカード(ブランドの "白線 on 黒" に合わせる) */
function drawCardFrame(ctx: SKRSContext2D, w: number, h: number, radius: number) {
  roundedRect(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = BG;
  ctx.fill();
  roundedRect(ctx, 1.5, 1.5, w - 3, h - 3, radius - 1.5);
  ctx.strokeStyle = LINE;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** ロゴを右側に薄く透かす(黒背景なので "lighter" で線だけが浮かぶ) */
async function drawWatermark(ctx: SKRSContext2D, cx: number, cy: number, size: number, alpha: number) {
  try {
    const logo = await loadImage(logoPath);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(logo, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  } catch {
    /* ロゴが読めなくても動作に影響なし */
  }
}

function drawProgressBar(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, progress: number) {
  roundedRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = TRACK;
  ctx.fill();

  const fillW = Math.max(h, w * Math.min(1, Math.max(0, progress)));
  roundedRect(ctx, x, y, fillW, h, h / 2);
  ctx.fillStyle = RUBY;
  ctx.fill();
}

async function drawAvatar(ctx: SKRSContext2D, avatar: Avatar, cx: number, cy: number, radius: number) {
  try {
    const image = await loadImage(avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } catch {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = TRACK;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** 長いユーザー名を maxWidth に収まるよう … で切る */
function fitText(ctx: SKRSContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export interface RankCardOptions {
  username: string;
  avatar: Avatar;
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  rank: number;
}

export async function generateRankCard(o: RankCardOptions): Promise<Buffer> {
  ensureFont();
  const width = 800;
  const height = 260;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawCardFrame(ctx, width, height, 28);
  await drawWatermark(ctx, width - 110, height / 2, 190, 0.22);
  await drawAvatar(ctx, o.avatar, 110, height / 2, 64);

  const textX = 210;
  ctx.fillStyle = TEXT;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(fitText(ctx, o.username, width - textX - 200), textX, 90);

  // 2行目: "LEVEL 5" (ルビー) + "• Rank #3" (グレー)
  const levelText = `LEVEL ${o.level}`;
  ctx.fillStyle = RUBY;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(levelText, textX, 130);
  const levelW = ctx.measureText(levelText).width;

  ctx.fillStyle = MUTED;
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`•  Rank #${o.rank}`, textX + levelW + 14, 130);

  drawProgressBar(ctx, textX, 160, width - textX - 60, 18, o.currentLevelXp / o.xpForNextLevel);

  ctx.fillStyle = MUTED;
  ctx.font = `18px ${FONT}`;
  const xpText = `${o.currentLevelXp.toLocaleString("en-US")} / ${o.xpForNextLevel.toLocaleString("en-US")} XP`;
  ctx.fillText(xpText, textX, 206);

  return canvas.toBuffer("image/png");
}

export interface LeaderboardEntry {
  username: string;
  avatar: Avatar;
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
}

export async function generateLeaderboardCard(entries: LeaderboardEntry[]): Promise<Buffer> {
  ensureFont();
  const width = 760;
  const rowH = 92;
  const gap = 12;
  const pad = 20;
  const height = pad * 2 + entries.length * rowH + (entries.length - 1) * gap;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const y = pad + i * (rowH + gap);

    roundedRect(ctx, pad, y, width - pad * 2, rowH, 16);
    ctx.fillStyle = PANEL;
    ctx.fill();
    if (i < 3) {
      roundedRect(ctx, pad + 0.75, y + 0.75, width - pad * 2 - 1.5, rowH - 1.5, 15);
      ctx.strokeStyle = i === 0 ? RUBY : LINE;
      ctx.globalAlpha = i === 0 ? 0.9 : 0.35;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const r = rowH / 2 - 14;
    const ax = pad + 16 + r;
    await drawAvatar(ctx, e.avatar, ax, y + rowH / 2, r);

    const textX = ax + r + 24;
    ctx.fillStyle = i === 0 ? RUBY : TEXT;
    ctx.font = `bold 24px ${FONT}`;
    const rankLabel = `#${i + 1}`;
    ctx.fillText(rankLabel, textX, y + 34);
    const rankW = ctx.measureText(rankLabel).width;

    ctx.fillStyle = TEXT;
    ctx.font = `22px ${FONT}`;
    const nameMax = width - (textX + rankW + 16) - pad - 110;
    ctx.fillText(fitText(ctx, e.username, nameMax), textX + rankW + 16, y + 34);

    ctx.fillStyle = MUTED;
    ctx.font = `bold 20px ${FONT}`;
    const lv = `LV ${e.level}`;
    ctx.fillText(lv, width - pad - 16 - ctx.measureText(lv).width, y + 34);

    drawProgressBar(ctx, textX, y + 52, width - textX - pad - 16, 12, e.currentLevelXp / e.xpForNextLevel);
  }
  return canvas.toBuffer("image/png");
}

export interface LevelUpImageOptions {
  username: string;
  avatar: Avatar;
  oldLevel: number;
  newLevel: number;
}

/** レベルアップ祝福パネルに載せる画像 */
export async function generateLevelUpImage(o: LevelUpImageOptions): Promise<Buffer> {
  ensureFont();
  const width = 640;
  const height = 220;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawCardFrame(ctx, width, height, 26);
  await drawWatermark(ctx, width - 90, height / 2, 170, 0.2);
  await drawAvatar(ctx, o.avatar, 88, height / 2, 52);

  const textX = 170;
  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText("L E V E L   U P", textX, 64);

  ctx.fillStyle = TEXT;
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText(fitText(ctx, o.username, width - textX - 120), textX, 104);

  ctx.font = `bold 52px ${FONT}`;
  ctx.fillStyle = MUTED;
  const oldText = String(o.oldLevel);
  ctx.fillText(oldText, textX, 168);
  const oldW = ctx.measureText(oldText).width;

  // 矢印はフォントに字形が無いことがあるため、線で描く
  const arrowX = textX + oldW + 18;
  const arrowY = 152;
  const arrowW = 34;
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX + arrowW, arrowY);
  ctx.moveTo(arrowX + arrowW - 10, arrowY - 10);
  ctx.lineTo(arrowX + arrowW, arrowY);
  ctx.lineTo(arrowX + arrowW - 10, arrowY + 10);
  ctx.stroke();

  ctx.fillStyle = RUBY;
  ctx.font = `bold 60px ${FONT}`;
  ctx.fillText(String(o.newLevel), arrowX + arrowW + 18, 170);

  return canvas.toBuffer("image/png");
}
