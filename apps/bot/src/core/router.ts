import { Events, type Interaction } from "discord.js";
import type { LumiiClient } from "../client.js";
import { notice, v2Ephemeral } from "./panel.js";

/** スラッシュコマンド / ボタン / モーダルを、登録済みのモジュールへ振り分ける。 */
export function registerRouter(client: LumiiClient): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
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
    } catch (err) {
      console.error("[router]", err);
      if (interaction.isRepliable()) {
        const payload = v2Ephemeral(notice.error("Something went wrong. Please try again later."));
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => undefined);
        else await interaction.reply(payload).catch(() => undefined);
      }
    }
  });
}
