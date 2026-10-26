import { defineModule } from "../../core/types.js";
import { rank } from "./commands/rank.js";
import { leaderboard } from "./commands/leaderboard.js";
import { levelConfig } from "./commands/level-config.js";
import { levelRole } from "./commands/level-role.js";
import { levelNoXp } from "./commands/level-noxp.js";
import { levelTest } from "./commands/level-test.js";
import { messageCreate } from "./events/messageCreate.js";
import { levelsInteractions } from "./interactions.js";

/**
 * Levels - XP / ランクカード(画像) / LevelUpMessage / LevelRole / 祝福パネル
 *
 *  メッセージ → XP付与 → レベルアップ → ロール付与 + 祝福パネル(画像つき)を送信
 *  パネルの  ボタンで祝える(1人1回・本人は不可)。祝った人数はボタンのラベルに表示される。
 */
export default defineModule({
  name: "levels",
  commands: [rank, leaderboard, levelConfig, levelRole, levelNoXp, levelTest],
  events: [messageCreate],
  interactions: levelsInteractions,
});
