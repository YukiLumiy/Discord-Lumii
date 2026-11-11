import { defineModule } from "../../core/types.js";
import { giveaway } from "./commands/giveaway.js";
import { giveawayInteractions } from "./interactions.js";
import { requeueGiveaways } from "./service.js";

/**
 * Giveaways - /giveaway start|end|cancel|reroll|list|entrants
 *   「Enter Giveaway」ボタンで参加 → 終了時刻になったら重み付き抽選 → 当選発表。
 *   終了はタイマーで行い、起動時に開催中の抽選を1回だけDBから読み直す(再起動しても取りこぼさない)。
 */
export default defineModule({
  name: "giveaways",
  commands: [giveaway],
  interactions: giveawayInteractions,
  onReady(client) {
    return requeueGiveaways(client);
  },
});
