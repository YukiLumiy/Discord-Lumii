import { prisma } from "@lumii/database";

export interface VerificationConfig {
  enabled: boolean;
  verifiedRoleId: string | null;
  unverifiedRoleId: string | null;
}

export async function getVerificationConfig(guildId: string): Promise<VerificationConfig | null> {
  const row = await prisma.verificationSettings.findUnique({ where: { guildId } });
  if (!row) return null;
  return { enabled: row.enabled, verifiedRoleId: row.verifiedRoleId, unverifiedRoleId: row.unverifiedRoleId };
}

export async function logVerification(guildId: string, userId: string, success: boolean): Promise<void> {
  await prisma.verificationLog.create({ data: { guildId, userId, success } }).catch((err: unknown) => {
    console.error("[verification] failed to write log", err);
  });
}
