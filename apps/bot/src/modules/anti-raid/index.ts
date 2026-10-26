import { defineModule } from "../../core/types.js";

/**
 * Anti Raid - 短時間の大量参加を検知してロックダウン/キック/BAN
 * TODO(Nyxの anti-raid を移植): events/ guildMemberAdd
 */
export default defineModule({ name: "anti-raid" });
