import { Events } from "discord.js";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LumiiClient } from "../client.js";
import type { LumiiModule } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.resolve(__dirname, "../modules");
// tsx(開発)では .ts、tsc後(本番)では .js
const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";

/** modules/<name>/index.(ts|js) を自動検出する。"_" で始まるフォルダは共有コード用なので無視。 */
export async function discoverModules(): Promise<LumiiModule[]> {
  const modules: LumiiModule[] = [];

  for (const dir of readdirSync(modulesDir).sort()) {
    if (dir.startsWith("_")) continue;
    const full = path.join(modulesDir, dir);
    if (!statSync(full).isDirectory()) continue;

    const entry = path.join(full, `index.${ext}`);
    if (!existsSync(entry)) continue;

    const mod = (await import(pathToFileURL(entry).href)) as { default?: LumiiModule };
    if (!mod.default) throw new Error(`modules/${dir}/index.${ext} has no default export`);
    modules.push(mod.default);
  }
  return modules;
}

export async function loadModules(client: LumiiClient): Promise<void> {
  const modules = await discoverModules();

  for (const mod of modules) {
    for (const cmd of mod.commands ?? []) client.commands.set(cmd.data.name, cmd);
    for (const handler of mod.interactions ?? []) client.interactionHandlers.push(handler);

    for (const ev of mod.events ?? []) {
      const listener = (...args: unknown[]) =>
        Promise.resolve((ev.execute as (...a: unknown[]) => unknown)(...args)).catch((err) =>
          console.error(`[event:${mod.name}:${String(ev.name)}]`, err),
        );
      if (ev.once) client.once(ev.name as string, listener);
      else client.on(ev.name as string, listener);
    }
  }

  // 長い prefix を先に判定する(例: "levels:celebrate" が "levels" より優先)
  client.interactionHandlers.sort((a, b) => b.prefix.length - a.prefix.length);

  client.once(Events.ClientReady, async (c) => {
    console.log(`[ready] Logged in as ${c.user.tag} (${modules.length} modules)`);
    for (const mod of modules) {
      try {
        await mod.onReady?.(client);
      } catch (err) {
        console.error(`[onReady:${mod.name}]`, err);
      }
    }
  });

  console.log(`[loader] modules: ${modules.map((m) => m.name).join(", ")}`);
}
