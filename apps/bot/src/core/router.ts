import { Events, type Interaction } from "discord.js";
import type { LumiiClient } from "../client.js";
import { notice, v2Ephemeral } from "./panel.js";

/** スラッシュコマンド / ボタン / モーダルを、登録済みのモジュールへ振り分ける。 */
export function registerRouter(client: LumiiClient): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Discordは受信から3秒以内の応答を求める。「届くまでの遅れ」と「処理にかかった時間」をログに残す。
    const receivedAt = Date.now();
    const label = interaction.isChatInputCommand()
      ? `/${interaction.commandName}`
      : interaction.isMessageComponent() || interaction.isModalSubmit()
        ? interaction.customId
        : interaction.type.toString();
    const delay = receivedAt - interaction.createdTimestamp;
    console.log(`[interaction] ${label} received (${delay}ms after Discord created it)`);

    try {
      if (interaction.isChatInputCommand()) {
        await client.commands.get(interaction.commandName)?.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
        return;
      }

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const handler = client.interactionHandlers.find((h) => interaction.customId.startsWith(h.prefix));
        await handler?.execute(interaction);
      }
      console.log(`[interaction] ${label} handled in ${Date.now() - receivedAt}ms`);
    } catch (err) {
      const e = err as { status?: number; code?: number | string; message?: string };
      console.error(`[router] ${label} failed after ${Date.now() - receivedAt}ms (status=${e.status ?? "-"} code=${e.code ?? "-"}): ${e.message ?? err}`);
      if (interaction.isRepliable()) {
        const payload = v2Ephemeral(notice.error("Something went wrong. Please try again later."));
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => undefined);
        else await interaction.reply(payload).catch(() => undefined);
      }
    }
  });
}
