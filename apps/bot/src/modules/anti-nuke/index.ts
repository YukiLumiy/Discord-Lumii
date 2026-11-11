import { defineModule } from "../../core/types.js";
import { every } from "../../core/scheduler.js";
import { antiNukeConfig } from "./commands/antinuke-config.js";
import { antiNukeWhitelist } from "./commands/antinuke-whitelist.js";
import { antiNukeOnAuditLog } from "./events/guildAuditLogEntryCreate.js";
import { pruneOld } from "./service.js";

/**
 * Anti Nuke - チャンネル削除・ロール削除・大量BAN・大量キックを短時間に繰り返したユーザーを自動で処罰する。
 *   実行者は監査ログのイベントから取得し、回数はメモリ上で数える(DBは設定のみ)。
 */
export default defineModule({
  name: "anti-nuke",
  commands: [antiNukeConfig, antiNukeWhitelist],
  events: [antiNukeOnAuditLog],
  onReady() {
    every("anti-nuke:prune", 5 * 60_000, pruneOld);
  },
});
