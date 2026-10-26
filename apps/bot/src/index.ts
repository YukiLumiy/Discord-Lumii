import { env } from "./env.js";
import { createClient } from "./client.js";
import { startHealthServer } from "./health.js";
import { loadModules } from "./core/loader.js";
import { registerRouter } from "./core/router.js";

async function main() {
  // Renderがポートを検知できるよう、最初にHTTPサーバーを起動する
  startHealthServer();

  const client = createClient();
  registerRouter(client);
  await loadModules(client);

  process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
