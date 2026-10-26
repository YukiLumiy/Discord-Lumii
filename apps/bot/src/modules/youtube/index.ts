import { defineModule } from "../../core/types.js";
import { every } from "../../core/scheduler.js";
import { CONFIG } from "../../config.js";
import { checkAllSubscriptions } from "./poller.js";

/** YT Content Notification - 新着動画を10分ごとに確認して通知する */
export default defineModule({
  name: "youtube",
  // commands: [youtubeAdd, youtubeRemove, youtubeList]   ← TODO
  onReady(client) {
    every("youtube:poll", CONFIG.youtube.checkIntervalMs, () => checkAllSubscriptions(client));
  },
});
