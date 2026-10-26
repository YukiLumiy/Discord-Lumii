import { createCanvas } from "@napi-rs/canvas";
import { ensureFont, FONT } from "../_shared/fonts.js";

const RUBY = "#e0115f";
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * 認証コードを画像にする。文字を傾けてノイズ線を重ねることで、
 * メッセージ本文を読み取るだけの自動化ツールではコードが取れないようにする。
 */
export function generateCaptchaImage(code: string): Buffer {
  ensureFont();
  const width = 360;
  const height = 120;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, width, height);

  // 背景のノイズ(曲線と点)
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 3 === 0 ? RUBY : "#ffffff";
    ctx.globalAlpha = rand(0.12, 0.3);
    ctx.beginPath();
    ctx.moveTo(rand(0, width), rand(0, height));
    ctx.quadraticCurveTo(rand(0, width), rand(0, height), rand(0, width), rand(0, height));
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = rand(0.1, 0.35);
    ctx.fillRect(rand(0, width), rand(0, height), 1.5, 1.5);
  }

  // 文字(1文字ずつ位置・角度・大きさをずらす)
  ctx.globalAlpha = 1;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const step = width / (code.length + 1);
  [...code].forEach((ch, i) => {
    ctx.save();
    ctx.translate(step * (i + 1) + rand(-6, 6), height / 2 + rand(-10, 10));
    ctx.rotate(rand(-0.4, 0.4));
    ctx.font = `bold ${Math.round(rand(46, 58))}px ${FONT}`;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f3d7e1";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  // 文字の上を横切る線
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = RUBY;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(rand(0, 30), rand(25, height - 25));
    ctx.bezierCurveTo(rand(80, 140), rand(0, height), rand(200, 260), rand(0, height), rand(width - 30, width), rand(25, height - 25));
    ctx.stroke();
  }

  // 白い細線の枠
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  return canvas.toBuffer("image/png");
}
