import { createServer } from "node:http";
import { prisma } from "@lumii/database";

/**
 * RenderのWeb Service + UptimeRobot用のヘルスチェックサーバー。
 * UptimeRobotがこのURLを5分おきに叩き、無料枠のスリープを防ぐ。
 * 併せてNeonのコンピュートも起こしておく。
 */
export function startHealthServer(): void {
  const port = Number(process.env.PORT ?? 3000);

  createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      prisma.$queryRaw`SELECT 1`.catch(() => undefined);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Lumii is running.");
      return;
    }
    res.writeHead(404);
    res.end();
  }).listen(port, () => console.log(`[health] listening on :${port}`));
}
