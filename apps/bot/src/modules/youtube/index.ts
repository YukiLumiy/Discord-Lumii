import { defineModule } from "../../core/types.js";
import { every } from "../../core/scheduler.js";
import { CONFIG } from "../../config.js";
import { youtube } from "./commands/youtube.js";
import { checkAllSubscriptions, loadSubscriptions } from "./service.js";

/**
 * YT Content Notification - 登録したYouTubeチャンネルの新着動画を10分ごとに確認して通知する。
 *   RSSフィードを使うのでAPIキー不要。購読はメモリに保持し、DBは登録時と新着通知時にだけ使う。
 */
export default defineModule({
  name: "youtube",
  commands: [youtube],
  async onReady(client) {
    await loadSubscriptions();
    every("youtube:poll", CONFIG.youtube.checkIntervalMs, () => checkAllSubscriptions(client));
  },
});
