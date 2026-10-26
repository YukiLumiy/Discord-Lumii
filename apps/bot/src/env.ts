import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// apps/bot/{src|dist} から見てモノレポルートは ../../.. 。
// 本番(Render)では環境変数が直接注入されるため .env が無くても正常。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const result = config({ path: path.resolve(__dirname, "../../../.env") });
if (result.error) config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  DISCORD_TOKEN: required("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: required("DISCORD_CLIENT_ID"),
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || undefined,
};
