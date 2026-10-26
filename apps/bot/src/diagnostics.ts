import { Events, RESTEvents, type Client } from "discord.js";
import { env } from "./env.js";

/**
 * 起動時の診断ログ。「Botがオンラインにならない」ときに、どこで止まっているかを
 * Renderのログから判断できるようにする(トークンはログに出さない)。
 */

const redact = (message: string) => message.replaceAll(env.DISCORD_TOKEN, "[token]");

/** DiscordのAPIに到達できるか(ホスティング側のIPがブロックされていないか)を確認する。 */
export async function checkDiscordConnectivity(): Promise<void> {
  try {
    const res = await fetch("https://discord.com/api/v10/gateway", { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      console.log(`[diag] Discord API reachable (HTTP ${res.status})`);
      return;
    }
    const body = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
    console.error(`[diag] Discord API returned HTTP ${res.status}. This server's IP may be rate limited or blocked. Body: ${body}`);
  } catch (err) {
    console.error("[diag] Could not reach discord.com at all", err);
  }
}

export function attachClientDiagnostics(client: Client): void {
  client.on(Events.Warn, (m) => console.warn("[discord:warn]", redact(m)));
  client.on(Events.Error, (e) => console.error("[discord:error]", e));
  client.on(Events.ShardError, (e, id) => console.error(`[discord:shardError #${id}]`, e));
  client.on(Events.ShardDisconnect, (event, id) => console.warn(`[discord:shardDisconnect #${id}] code=${event.code}`));
  client.on(Events.ShardReconnecting, (id) => console.warn(`[discord:shardReconnecting #${id}]`));
  client.rest.on(RESTEvents.RateLimited, (info) =>
    console.warn(`[discord:rateLimited] ${info.method} ${info.route} global=${info.global} retryAfter=${info.timeToReset}ms`),
  );

  // 接続の進み具合(WebSocketの接続・認証・ハートビート)だけを抜き出して表示する
  client.on(Events.Debug, (m) => {
    if (/(Preparing to connect|Connecting|Identif|Session|Ready|Hit a|rate limit|Heartbeat acknowledged|Fetching|Provided token)/i.test(m)) {
      console.log("[discord:debug]", redact(m).slice(0, 220));
    }
  });
}
