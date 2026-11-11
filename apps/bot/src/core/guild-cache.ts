/**
 * サーバーごとの設定を短時間メモリに保持するキャッシュ。
 * メッセージや監査ログのたびにDBを引かないための仕組み(Neon無料枠の計算時間の節約にもなる)。
 * 設定を変更したら invalidate() を呼ぶ。
 */
export function createGuildCache<T>(load: (guildId: string) => Promise<T>, ttlMs = 30_000) {
  const entries = new Map<string, { at: number; value: T }>();

  return {
    async get(guildId: string): Promise<T> {
      const hit = entries.get(guildId);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      const value = await load(guildId);
      entries.set(guildId, { at: Date.now(), value });
      return value;
    },
    invalidate(guildId: string): void {
      entries.delete(guildId);
    },
  };
}
