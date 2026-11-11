import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from "discord.js";
import { defineEvent } from "../../../core/types.js";
import { COLORS } from "../../../core/panel.js";
import { logPanel, mention, sendLog } from "../service.js";

/**
 * 監査ログに記録された操作を、実行者つきでログに残す。
 *   Moderation: BAN / BAN解除 / キック / タイムアウト
 *   Server    : チャンネル・ロール・サーバー設定の作成/削除/変更
 * 「監査ログに新しい記録が作られた」イベントを使うので、操作のたびに監査ログを検索する必要がない。
 * (Botに「監査ログを表示」の権限が必要)
 */

const KEY_LABELS: Record<string, string> = {
  name: "Name",
  topic: "Topic",
  nsfw: "Age-restricted",
  rate_limit_per_user: "Slowmode (seconds)",
  bitrate: "Bitrate",
  user_limit: "User limit",
  color: "Color",
  hoist: "Shown separately",
  mentionable: "Mentionable",
  permissions: "Permissions",
  permission_overwrites: "Permission overwrites",
  icon_hash: "Icon",
  verification_level: "Verification level",
  default_message_notifications: "Default notifications",
  afk_timeout: "AFK timeout",
  parent_id: "Category",
};
const SKIPPED_KEYS = new Set(["position", "id", "type"]);

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "*none*";
  if (key === "color" && typeof value === "number") return `#${value.toString(16).padStart(6, "0")}`;
  if (key === "parent_id") return `<#${value}>`;
  if (typeof value === "object" || key === "permissions" || key === "permission_overwrites" || key === "icon_hash") return "*changed*";
  const s = String(value).replace(/`/g, "'");
  return s.length > 80 ? `${s.slice(0, 80)}...` : s;
}

function describeChanges(entry: GuildAuditLogsEntry): string[] {
  const lines: string[] = [];
  for (const change of entry.changes ?? []) {
    if (SKIPPED_KEYS.has(change.key)) continue;
    const label = KEY_LABELS[change.key] ?? change.key;
    const simple = change.key === "permissions" || change.key === "permission_overwrites" || change.key === "icon_hash";
    lines.push(simple ? `> **${label}:** changed` : `> **${label}:** ${formatValue(change.key, change.old)} to ${formatValue(change.key, change.new)}`);
  }
  return lines;
}

const changeValue = (entry: GuildAuditLogsEntry, key: string) => entry.changes?.find((c) => c.key === key);

function byLine(entry: GuildAuditLogsEntry): string {
  return `**By:** ${mention(entry.executorId)}`;
}
const reasonLine = (entry: GuildAuditLogsEntry) => (entry.reason ? `**Reason:** ${entry.reason.replace(/`/g, "'")}` : null);

async function logModeration(guild: Guild, entry: GuildAuditLogsEntry) {
  const user = entry.target && "username" in entry.target ? entry.target : null;
  const targetLine = `**User:** ${mention(entry.targetId)}${user ? ` (\`${user.username}\`)` : ""}`;
  const avatar = user && "displayAvatarURL" in user ? (user as { displayAvatarURL: (o: object) => string }).displayAvatarURL({ extension: "png", size: 64 }) : undefined;

  const make = (title: string, color: number, extra: (string | null)[] = []) =>
    sendLog(guild.client, guild.id, "moderation", logPanel({ title, color, thumbnailUrl: avatar, lines: [targetLine, byLine(entry), reasonLine(entry), ...extra, `-# User ID: ${entry.targetId}`] }));

  switch (entry.action) {
    case AuditLogEvent.MemberBanAdd:
      return make("Member banned", COLORS.danger);
    case AuditLogEvent.MemberBanRemove:
      return make("Member unbanned", COLORS.success);
    case AuditLogEvent.MemberKick:
      return make("Member kicked", COLORS.danger);
    case AuditLogEvent.MemberUpdate: {
      const timeout = changeValue(entry, "communication_disabled_until");
      if (!timeout) return; // タイムアウト以外のメンバー更新(ニックネームやロール)は Members のログが担当
      return timeout.new
        ? make("Member timed out", COLORS.danger, [`**Until:** <t:${Math.floor(new Date(String(timeout.new)).getTime() / 1000)}:f>`])
        : make("Timeout removed", COLORS.success);
    }
  }
}

async function logServer(guild: Guild, entry: GuildAuditLogsEntry) {
  const nameChange = changeValue(entry, "name");
  const name = String(nameChange?.new ?? nameChange?.old ?? "").replace(/`/g, "'");
  const make = (title: string, color: number, lines: (string | null)[]) =>
    sendLog(guild.client, guild.id, "server", logPanel({ title, color, lines: [...lines, byLine(entry), reasonLine(entry)] }));

  switch (entry.action) {
    case AuditLogEvent.ChannelCreate:
      return make("Channel created", COLORS.success, [`**Channel:** <#${entry.targetId}>${name ? ` (\`${name}\`)` : ""}`]);
    case AuditLogEvent.ChannelDelete:
      return make("Channel deleted", COLORS.danger, [`**Channel:** \`${name || entry.targetId}\``]);
    case AuditLogEvent.RoleCreate:
      return make("Role created", COLORS.success, [`**Role:** <@&${entry.targetId}>${name ? ` (\`${name}\`)` : ""}`]);
    case AuditLogEvent.RoleDelete:
      return make("Role deleted", COLORS.danger, [`**Role:** \`${name || entry.targetId}\``]);
    case AuditLogEvent.ChannelUpdate:
    case AuditLogEvent.RoleUpdate:
    case AuditLogEvent.GuildUpdate: {
      const changes = describeChanges(entry);
      if (changes.length === 0) return; // 並び順の変更など、記録する意味のない更新は除く
      const [title, target] =
        entry.action === AuditLogEvent.ChannelUpdate
          ? ["Channel updated", `**Channel:** <#${entry.targetId}>`]
          : entry.action === AuditLogEvent.RoleUpdate
            ? ["Role updated", `**Role:** <@&${entry.targetId}>`]
            : ["Server settings updated", null];
      return make(title, COLORS.neutral, [target, ...changes]);
    }
  }
}

const MODERATION = new Set<AuditLogEvent>([AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberBanRemove, AuditLogEvent.MemberKick, AuditLogEvent.MemberUpdate]);
const SERVER = new Set<AuditLogEvent>([
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.ChannelUpdate,
  AuditLogEvent.RoleCreate,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.GuildUpdate,
]);

export const logAuditEntries = defineEvent({
  name: "guildAuditLogEntryCreate",
  async execute(entry, guild) {
    if (MODERATION.has(entry.action)) await logModeration(guild, entry);
    else if (SERVER.has(entry.action)) await logServer(guild, entry);
  },
});
