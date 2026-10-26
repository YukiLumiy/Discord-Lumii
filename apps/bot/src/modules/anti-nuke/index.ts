import { defineModule } from "../../core/types.js";

/**
 * Anti Nuke - チャンネル/ロール削除や大量BANを検知して実行者を処罰
 * TODO(Nyxの anti-nuke を移植): events/ channelDelete, roleDelete, guildBanAdd + 監査ログ
 */
export default defineModule({ name: "anti-nuke" });
