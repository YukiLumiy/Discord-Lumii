import { defineEvent } from "../../../core/types.js";
import { handleJoin } from "../service.js";

export const antiRaidOnJoin = defineEvent({
  name: "guildMemberAdd",
  async execute(member) {
    await handleJoin(member);
  },
});
