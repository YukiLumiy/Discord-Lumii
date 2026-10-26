import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { Command, InteractionHandler } from "./core/types.js";

export class LumiiClient extends Client {
  readonly commands = new Collection<string, Command>();
  readonly interactionHandlers: InteractionHandler[] = [];
}

export function createClient(): LumiiClient {
  return new LumiiClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    allowedMentions: { parse: [] },
  });
}
