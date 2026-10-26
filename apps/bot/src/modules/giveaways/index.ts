import { defineModule } from "../../core/types.js";
import { every } from "../../core/scheduler.js";
import { giveaway } from "./commands/giveaway.js";
import { giveawayInteractions } from "./interactions.js";
import { endDueGiveaways } from "./service.js";

/**
 * Giveaways - /giveaway start|end|cancel|reroll|list|entrants
 *   「Enter Giveaway」ボタンで参加 → 終了時刻になったら重み付き抽選 → 当選発表。
 *   終了判定は15秒ごとにDBを見て行うので、Botが再起動しても取りこぼさない。
 */
export default defineModule({
  name: "giveaways",
  commands: [giveaway],
  interactions: giveawayInteractions,
  onReady(client) {
    every("giveaways:end", 15_000, () => endDueGiveaways(client));
  },
});
