import { defineEvent } from "../../../core/types.js";
import { COLORS } from "../../../core/panel.js";
import { logPanel, mention, sendLog, timeAgo } from "../service.js";

export const logMemberJoin = defineEvent({
  name: "guildMemberAdd",
  async execute(member) {
    await sendLog(
      member.client,
      member.guild.id,
      "member",
      logPanel({
        title: member.user.bot ? "Bot added" : "Member joined",
        color: COLORS.success,
        thumbnailUrl: member.user.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [
          `**User:** ${mention(member.id)} (\`${member.user.username}\`)`,
          `**Account created:** ${timeAgo(member.user.createdTimestamp)}`,
          `**Member count:** ${member.guild.memberCount.toLocaleString("en-US")}`,
          `-# User ID: ${member.id}`,
        ],
      }),
    );
  },
});

export const logMemberLeave = defineEvent({
  name: "guildMemberRemove",
  async execute(member) {
    // ロールは、キャッシュに残っている場合だけ表示できる
    const roles = member.partial ? [] : member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`);
    await sendLog(
      member.client,
      member.guild.id,
      "member",
      logPanel({
        title: member.user.bot ? "Bot removed" : "Member left",
        color: COLORS.danger,
        thumbnailUrl: member.user.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [
          `**User:** ${mention(member.id)} (\`${member.user.username}\`)`,
          member.joinedTimestamp ? `**Joined the server:** ${timeAgo(member.joinedTimestamp)}` : null,
          roles.length ? `**Roles:** ${roles.join(", ")}` : null,
          `**Member count:** ${member.guild.memberCount.toLocaleString("en-US")}`,
          `-# User ID: ${member.id}`,
        ],
      }),
    );
  },
});

export const logMemberUpdate = defineEvent({
  name: "guildMemberUpdate",
  async execute(before, after) {
    // 更新前の情報が無い(部分的なデータ)場合は、何が変わったか分からないので記録しない
    if (before.partial) return;

    const lines: string[] = [];
    if (before.nickname !== after.nickname) lines.push(`**Nickname:** ${before.nickname ?? "*none*"} to ${after.nickname ?? "*none*"}`);

    const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    if (added.size) lines.push(`**Roles added:** ${added.map((r) => `<@&${r.id}>`).join(", ")}`);
    if (removed.size) lines.push(`**Roles removed:** ${removed.map((r) => `<@&${r.id}>`).join(", ")}`);
    if (lines.length === 0) return;

    await sendLog(
      after.client,
      after.guild.id,
      "member",
      logPanel({
        title: "Member updated",
        thumbnailUrl: after.user.displayAvatarURL({ extension: "png", size: 64 }),
        lines: [`**User:** ${mention(after.id)}`, ...lines, `-# User ID: ${after.id}`],
      }),
    );
  },
});
