import { randomInt } from "node:crypto";

/**
 * 認証コードの発行と照合。コードはメモリ上にだけ保持する(単一プロセスのBotなら十分)。
 * 5分で期限切れ、または5回間違えると無効になる。
 */
interface PendingCode {
  code: string;
  expiresAt: number;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 6;
// 0/O/1/I など紛らわしい文字は除く
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const pending = new Map<string, PendingCode>();
const keyOf = (guildId: string, userId: string) => `${guildId}:${userId}`;

export function issueCode(guildId: string, userId: string): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CHARS[randomInt(CHARS.length)];
  pending.set(keyOf(guildId, userId), { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  return code;
}

export type CodeCheckResult = "ok" | "no_pending_code" | "expired" | "too_many_attempts" | "incorrect";

export function checkCode(guildId: string, userId: string, input: string): CodeCheckResult {
  const key = keyOf(guildId, userId);
  const entry = pending.get(key);
  if (!entry) return "no_pending_code";

  if (Date.now() > entry.expiresAt) {
    pending.delete(key);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    pending.delete(key);
    return "too_many_attempts";
  }
  if (input.trim().toUpperCase() !== entry.code) {
    entry.attempts += 1;
    return "incorrect";
  }

  pending.delete(key);
  return "ok";
}

// 期限切れのコードが溜まり続けないよう、時々掃除する
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pending) if (now > entry.expiresAt) pending.delete(key);
}, 60_000).unref();
