import { PrismaClient } from "../generated/client/index.js";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// NeonのサーバーレスドライバーはブラウザのWebSocket APIを前提にしているため、
// Node.js環境ではwsパッケージをポリフィルとして渡す必要がある。
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Neonのドライバー経由でクエリを実行する(無料ホストでも動かしやすい構成)。
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/client/index.js";
