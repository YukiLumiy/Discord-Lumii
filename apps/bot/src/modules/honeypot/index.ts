import { defineModule } from "../../core/types.js";
import { honeypotConfig } from "./commands/honeypot-config.js";
import { honeypotSetup } from "./commands/honeypot-setup.js";
import { honeypotOnMessage } from "./events/messageCreate.js";

/**
 * Honeypot - 罠チャンネルに書き込んだアカウントを自動で処罰する(ban / softban / kick / timeout)。
 *   スタッフ(管理者・サーバー管理権限)と除外ロールは対象外。メッセージは先に削除してログへ要約を残す。
 */
export default defineModule({
  name: "honeypot",
  commands: [honeypotSetup, honeypotConfig],
  events: [honeypotOnMessage],
});
