import { defineModule } from "../../core/types.js";
import { verificationSetup } from "./commands/verification-setup.js";
import { verificationConfig } from "./commands/verification-config.js";
import { guildMemberAdd } from "./events/guildMemberAdd.js";
import { verificationInteractions } from "./interactions.js";

/**
 * Verification - 認証パネル(ボタン) → 画像コードを入力 → 認証済みロールを付与
 *   参加時に未認証ロールを付け、認証できたら外す。成功/失敗は VerificationLog に記録。
 */
export default defineModule({
  name: "verification",
  commands: [verificationSetup, verificationConfig],
  events: [guildMemberAdd],
  interactions: verificationInteractions,
});
