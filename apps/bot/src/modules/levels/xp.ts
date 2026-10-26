/**
 * 累計XP ⇔ レベルの計算。よくあるレベリングBotと同じ二次関数のカーブ。
 * xpForLevel(n) = レベル n から n+1 に上がるために必要なXP
 */
export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

const MAX_CALCULATED_LEVEL = 100_000;

export function calculateLevel(totalXp: number) {
  let level = 0;
  let remaining = Number.isFinite(totalXp) ? Math.max(0, totalXp) : 0;

  while (remaining >= xpForLevel(level) && level < MAX_CALCULATED_LEVEL) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentLevelXp: remaining, xpForNextLevel: xpForLevel(level) };
}

export function randomXp(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
