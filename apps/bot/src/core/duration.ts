const UNIT_MS = { w: 604_800_000, d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 } as const;

/**
 * "10m" "2h" "1d" "1w" "1h30m" のような文字列をミリ秒にする。解釈できなければ null。
 */
export function parseDuration(input: string): number | null {
  const compact = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!compact || !/^(\d+[wdhms])+$/.test(compact)) return null;

  let total = 0;
  for (const [, amount, unit] of compact.matchAll(/(\d+)([wdhms])/g)) {
    total += Number(amount) * UNIT_MS[unit as keyof typeof UNIT_MS];
  }
  return total > 0 ? total : null;
}
