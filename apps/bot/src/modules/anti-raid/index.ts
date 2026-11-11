import { defineModule } from "../../core/types.js";
import { every } from "../../core/scheduler.js";
import { antiRaidConfig } from "./commands/antiraid-config.js";
import { antiRaidUnlock } from "./commands/antiraid-unlock.js";
import { antiRaidOnJoin } from "./events/guildMemberAdd.js";
import { restoreLockdowns, tick } from "./service.js";

/**
 * Anti Raid - 短時間の大量参加を検知して、ロックダウン / キック / BAN / ログのみ を実行する。
 *   ロックダウンは認証レベルを Very High にし、レイドが収まったら自動で元に戻す。
 *   常時の保護として、新しすぎるアカウントの自動キック(min_account_age_days)も設定できる。
 */
export default defineModule({
  name: "anti-raid",
  commands: [antiRaidConfig, antiRaidUnlock],
  events: [antiRaidOnJoin],
  onReady(client) {
    every("anti-raid:tick", 30_000, () => tick(client));
    return restoreLockdowns(client);
  },
});
