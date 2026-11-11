import { defineModule } from "../../core/types.js";
import { logConfig } from "./commands/log-config.js";
import { logAuditEntries } from "./events/auditLog.js";
import { logMemberJoin, logMemberLeave, logMemberUpdate } from "./events/member.js";
import { logMessageBulkDelete, logMessageDelete, logMessageUpdate } from "./events/message.js";
import { logVoiceState } from "./events/voice.js";

/**
 * Logs - 種類ごとに送信先を決めて記録する(未設定の種類は何も記録しない)。
 *   message   : メッセージの削除・編集
 *   member    : 参加・退出・ニックネーム・ロールの変更
 *   moderation: BAN・BAN解除・キック・タイムアウト(監査ログから実行者つき)
 *   server    : チャンネル・ロール・サーバー設定の変更(監査ログから実行者つき)
 *   voice     : ボイスチャンネルの参加・退出・移動
 */
export default defineModule({
  name: "logs",
  commands: [logConfig],
  events: [logMessageDelete, logMessageUpdate, logMessageBulkDelete, logMemberJoin, logMemberLeave, logMemberUpdate, logVoiceState, logAuditEntries],
});
