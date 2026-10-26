import { defineModule } from "../../core/types.js";
import { clanSetup } from "./commands/clan-setup.js";
import { clanInteractions } from "./interactions.js";

/**
 * ClanJoin - Roblox Rivals のクランに加入するための審査フォーム。
 *   常設パネルのボタン → モーダル → 管理者専用チャンネルへ回答を送信
 */
export default defineModule({
  name: "clan",
  commands: [clanSetup],
  interactions: clanInteractions,
});
