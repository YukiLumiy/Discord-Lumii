import { GlobalFonts } from "@napi-rs/canvas";
import { createRequire } from "node:module";

/**
 * 画像生成(ランクカード・認証コードなど)で使うフォントの登録。
 * Linuxの本番ホストにはシステムフォントが無く、未登録だと文字が描画されない。
 * ユーザー名に日本語などが入りうるため Noto Sans JP を同梱して登録する。
 */
const require = createRequire(import.meta.url);
export const FONT = "Noto Sans JP";
let ready = false;

export function ensureFont(): void {
  if (ready) return;
  try {
    if (!GlobalFonts.has(FONT)) {
      GlobalFonts.registerFromPath(require.resolve("@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2"), FONT);
      GlobalFonts.registerFromPath(require.resolve("@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff2"), FONT);
    }
  } catch (err) {
    console.error("[fonts] Failed to register font, falling back to system font", err);
  }
  ready = true;
}
