import { REST, Routes } from "discord.js";
import { env } from "../env.js";

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
const route = env.DEV_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

await rest.put(route, { body: [] });
console.log(`Cleared commands ${env.DEV_GUILD_ID ? `in guild ${env.DEV_GUILD_ID}` : "globally"}.`);
process.exit(0);
