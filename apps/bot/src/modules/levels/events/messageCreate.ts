import { defineEvent } from "../../../core/types.js";
import { addXp } from "../service.js";
import { getLevelConfig, getNoXpChannels } from "../settings.js";
import { randomXp } from "../xp.js";

// XPのクールダウンはメモリで管理(再起動でリセットされて問題ない)。
const lastXpAt = new Map<string, number>();

export const messageCreate = defineEvent({
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guildId) return;

    const config = await getLevelConfig(message.guildId);
    if (!config.enabled) return;

    const noXp = await getNoXpChannels(message.guildId);
    // スレッドは親チャンネルの設定に従う
    if (noXp.has(message.channelId) || (message.channel.isThread() && message.channel.parentId && noXp.has(message.channel.parentId))) return;

    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const last = lastXpAt.get(key);
    if (last && now - last < config.cooldownSeconds * 1000) return;
    lastXpAt.set(key, now);

    await addXp(message.client, message.guildId, message.author.id, randomXp(config.xpMin, config.xpMax), message.channelId);
  },
});
