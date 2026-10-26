import type {
  Awaitable,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ClientEvents,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { LumiiClient } from "../client.js";

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction): Awaitable<void>;
  autocomplete?(interaction: AutocompleteInteraction): Awaitable<void>;
}

export type AnyEvent = {
  [K in keyof ClientEvents]: {
    name: K;
    once?: boolean;
    execute: (...args: ClientEvents[K]) => Awaitable<void>;
  };
}[keyof ClientEvents];

/**
 * ボタン / セレクトメニュー / モーダルの処理。
 * customId が `prefix` で始まるものがこのハンドラに届く。
 * 命名規則: "<module>:<action>[:<data>]"  例) "clan:apply", "levels:celebrate:123456"
 */
export interface InteractionHandler {
  prefix: string;
  execute(interaction: MessageComponentInteraction | ModalSubmitInteraction): Awaitable<void>;
}

export interface LumiiModule {
  name: string;
  commands?: Command[];
  events?: AnyEvent[];
  interactions?: InteractionHandler[];
  /** Botがログインした後に1度だけ呼ばれる(定期処理の開始など) */
  onReady?(client: LumiiClient): Awaitable<void>;
}

export const defineModule = (m: LumiiModule): LumiiModule => m;
export const defineCommand = (c: Command): Command => c;
export function defineEvent<K extends keyof ClientEvents>(e: {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Awaitable<void>;
}): AnyEvent {
  return e as AnyEvent;
}
