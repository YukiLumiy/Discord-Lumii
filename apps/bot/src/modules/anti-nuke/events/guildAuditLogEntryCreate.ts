import { defineEvent } from "../../../core/types.js";
import { handleAuditLogEntry } from "../service.js";

export const antiNukeOnAuditLog = defineEvent({
  name: "guildAuditLogEntryCreate",
  async execute(entry, guild) {
    await handleAuditLogEntry(entry, guild);
  },
});
