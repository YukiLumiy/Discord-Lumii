import { defineModule } from "../../core/types.js";

/**
 * 個別VC - トリガーVCに入ると専用VCを作成し、空になったら削除
 * TODO(Nyxの private-vc を移植): events/ voiceStateUpdate
 */
export default defineModule({ name: "private-vc" });
