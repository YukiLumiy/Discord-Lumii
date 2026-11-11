import { createServer } from "node:http";
/**
 * RenderのWeb Service + UptimeRobot用のヘルスチェックサーバー。
 * UptimeRobotがこのURLを5分おきに叩き、Render無料枠のスリープを防ぐ。
 * ここではDBに触れない。Neon無料枠は月100 CU-時間なので、定期的にDBを起こすと
 * 枠を使い切って月末までDBが止まってしまう(アクセスが無い間は5分で自動停止させる)。
 */
export function startHealthServer(): void {
  const port = Number(process.env.PORT ?? 3000);

  createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Lumii is running.");
      return;
    }
    res.writeHead(404);
    res.end();
  }).listen(port, () => console.log(`[health] listening on :${port}`));
}
