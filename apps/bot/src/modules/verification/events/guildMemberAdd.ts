import { defineEvent } from "../../../core/types.js";
import { getVerificationConfig } from "../service.js";

/** 新しく参加したメンバーに「未認証ロール」を付ける(認証が有効で、ロールが設定されているとき)。 */
export const guildMemberAdd = defineEvent({
  name: "guildMemberAdd",
  async execute(member) {
    if (member.user.bot) return;

    const config = await getVerificationConfig(member.guild.id);
    if (!config?.enabled || !config.unverifiedRoleId) return;

    await member.roles.add(config.unverifiedRoleId).catch((err) => {
      console.error(`[verification] Failed to add unverified role to ${member.id} in ${member.guild.id}`, err);
    });
  },
});
