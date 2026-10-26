import { Events } from "discord.js";
import { env } from "./env.js";
import { createClient } from "./client.js";
import { startHealthServer } from "./health.js";
import { loadModules } from "./core/loader.js";
import { registerRouter } from "./core/router.js";
import { attachClientDiagnostics, checkDiscordConnectivity } from "./diagnostics.js";

async function main() {
  // Renderがポートを検知できるよう、最初にHTTPサーバーを起動する
  startHealthServer();

  const client = createClient();
  attachClientDiagnostics(client);
  registerRouter(client);
  await loadModules(client);

  process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

  await checkDiscordConnectivity();

  // 60秒たってもオンラインにならない場合は、原因の候補をログに出す
  const watchdog = setTimeout(() => {
    console.error(
      "[startup] Still not ready after 60s. Likely causes: (1) Discord is rate limiting this host's IP (see the [diag] lines above), " +
        "(2) the bot token is wrong or was reset, (3) a privileged intent is not enabled in the Developer Portal.",
    );
  }, 60_000);
  client.once(Events.ClientReady, () => clearTimeout(watchdog));

  const startedAt = Date.now();
  console.log("[startup] Logging in to Discord...");
  await client.login(env.DISCORD_TOKEN);
  console.log(`[startup] login() finished after ${Date.now() - startedAt}ms`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
