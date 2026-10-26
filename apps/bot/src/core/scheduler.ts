/**
 * 定期処理ヘルパー。前回の処理が終わっていなければスキップし、例外でタイマーが止まらないようにする。
 * @example every("youtube:poll", CONFIG.youtube.checkIntervalMs, () => checkAll(client));
 */
export function every(name: string, intervalMs: number, task: () => Promise<void> | void): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await task();
    } catch (err) {
      console.error(`[scheduler:${name}]`, err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  void tick(); // 起動直後にも1回実行
  return () => clearInterval(timer);
}
