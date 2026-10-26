import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
} from "discord.js";
import type { InteractionHandler } from "../../core/types.js";
import { notice, panelWithImage, v2Ephemeral } from "../../core/panel.js";
import { checkCode, issueCode, type CodeCheckResult } from "./code.js";
import { generateCaptchaImage } from "./captcha.js";
import { getVerificationConfig, logVerification } from "./service.js";

const FAILURE_MESSAGES: Record<Exclude<CodeCheckResult, "ok">, string> = {
  no_pending_code: "No verification is in progress. Press **Verify** again to get a new code.",
  expired: "Your code expired. Press **Verify** again to get a new one.",
  too_many_attempts: "Too many incorrect attempts. Press **Verify** again to get a new code.",
  incorrect: "That code doesn't match. Check the image and try again.",
};

export const verificationInteractions: InteractionHandler[] = [
  // パネルの「Verify」ボタン → 画像コードを本人にだけ表示する
  {
    prefix: "verification:start",
    async execute(interaction) {
      if (!interaction.isButton() || !interaction.guildId) return;

      const config = await getVerificationConfig(interaction.guildId);
      if (!config?.enabled || !config.verifiedRoleId) {
        await interaction.reply(v2Ephemeral(notice.error("Verification isn't available right now. Please contact an admin.")));
        return;
      }
      const member = interaction.member as GuildMember;
      if (member.roles.cache.has(config.verifiedRoleId)) {
        await interaction.reply(v2Ephemeral(notice.info("You're already verified.", "Already verified")));
        return;
      }

      const code = issueCode(interaction.guildId, interaction.user.id);
      const image = generateCaptchaImage(code);
      const container = panelWithImage({
        title: "Your verification code",
        text: "Type the characters shown below. The code expires in 5 minutes.",
        imageName: "captcha.png",
        buttons: [new ButtonBuilder().setCustomId("verification:enter").setLabel("Enter code").setStyle(ButtonStyle.Primary)],
      });
      await interaction.reply({ ...v2Ephemeral(container), files: [new AttachmentBuilder(image, { name: "captcha.png" })] });
    },
  },

  // 「Enter code」ボタン → 入力モーダル
  {
    prefix: "verification:enter",
    async execute(interaction) {
      if (!interaction.isButton()) return;
      const modal = new ModalBuilder()
        .setCustomId("verification:submit")
        .setTitle("Enter your verification code")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("code")
              .setLabel("6-character code")
              .setStyle(TextInputStyle.Short)
              .setMinLength(6)
              .setMaxLength(6)
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
    },
  },

  // モーダル送信 → 照合してロールを入れ替える
  {
    prefix: "verification:submit",
    async execute(interaction) {
      if (!interaction.isModalSubmit() || !interaction.guildId || !interaction.member) return;
      const guildId = interaction.guildId;

      const result = checkCode(guildId, interaction.user.id, interaction.fields.getTextInputValue("code"));
      if (result !== "ok") {
        await interaction.reply(v2Ephemeral(notice.error(FAILURE_MESSAGES[result], "Verification failed")));
        await logVerification(guildId, interaction.user.id, false);
        return;
      }

      const config = await getVerificationConfig(guildId);
      if (!config?.verifiedRoleId) {
        await interaction.reply(v2Ephemeral(notice.error("Verification isn't available right now. Please contact an admin.")));
        return;
      }

      const member = interaction.member as GuildMember;
      try {
        await member.roles.add(config.verifiedRoleId);
        if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
          await member.roles.remove(config.unverifiedRoleId).catch(() => undefined);
        }
      } catch (err) {
        // Botの権限不足やロールの位置が原因のことが多い
        console.error(`[verification] Failed to give verified role to ${member.id}`, err);
        await logVerification(guildId, interaction.user.id, false);
        await interaction.reply(v2Ephemeral(notice.error("The code was correct, but I couldn't give you the role. Please contact an admin.")));
        return;
      }

      await logVerification(guildId, interaction.user.id, true);
      await interaction.reply(v2Ephemeral(notice.success("You're verified. Welcome in.", "Verified")));
    },
  },
];
