import { REST, Routes } from "discord.js";
import { env } from "../env.js";
import { discoverModules } from "../core/loader.js";

const modules = await discoverModules();
const body = modules.flatMap((m) => (m.commands ?? []).map((c) => c.data.toJSON()));

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
const route = env.DEV_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

await rest.put(route, { body });
console.log(`Registered ${body.length} commands ${env.DEV_GUILD_ID ? `to guild ${env.DEV_GUILD_ID}` : "globally"}.`);
process.exit(0);
