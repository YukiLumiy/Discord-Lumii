import { defineModule } from "../../core/types.js";
import { lfpSetup } from "./commands/lfp-setup.js";
import { lfpInteractions } from "./interactions.js";

/**
 * Looking for Playing - Roblox Rivals で一緒に Duo を組む相手を探す。
 *   常設パネルのボタン → モーダル → 一般ユーザーが見えるチャンネルへ募集を投稿
 */
export default defineModule({
  name: "lfp",
  commands: [lfpSetup],
  interactions: lfpInteractions,
});
