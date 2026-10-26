import { defineModule } from "../../core/types.js";

/**
 * Honeypot - 罠チャンネルに書き込んだユーザーを自動で処罰する
 * TODO(Nyxから移植 or 新規): commands/ honeypot-setup / events/ messageCreate
 */
export default defineModule({ name: "honeypot" });
