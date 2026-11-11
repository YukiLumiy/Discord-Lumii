import { defineEvent } from "../../../core/types.js";
import { handleHoneypotMessage } from "../service.js";

export const honeypotOnMessage = defineEvent({
  name: "messageCreate",
  async execute(message) {
    await handleHoneypotMessage(message);
  },
});
