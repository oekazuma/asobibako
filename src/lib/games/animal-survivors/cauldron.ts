import type { Stage } from './stages/forest';

/** 釜の強さと、始めるときに賭けたコイン */
export interface Heat {
  level: number;
  bet: number;
}

export const PLAIN: Heat = { level: 2, bet: 0 };
export const HEAT_MAX = 9;
export const MAX_BET = 6000;

export const snap = (h: number) => Math.min(HEAT_MAX, Math.max(0, Math.round(h * 10) / 10));
export const heatLabel = (h: number) => snap(h).toFixed(1);

/** 2.0 までと 2.0 からで別の傾きにする（2.0 が今の難しさ） */
const bend = (h: number, at0: number, at9: number) =>
  h <= 2 ? at0 + ((1 - at0) * h) / 2 : 1 + ((at9 - 1) * (h - 2)) / 7;

export const HP_AT9 = 4;
export const ATK_AT9 = 2.5;
export const hpMul = (h: number) => bend(h, 0.6, HP_AT9);
export const atkMul = (h: number) => bend(h, 0.7, ATK_AT9);
export const coinMul = (h: number) => bend(h, 0.5, 4);

/** 賭けは上のほうで急に増える。2.0 を少しでも越えたら賭けがあることを見せるため、最低 10 枚 */
export const betOf = (h: number) => (h <= 2 ? 0 : Math.max(10, Math.round((MAX_BET * ((h - 2) / 7) ** 1.5) / 10) * 10));

/** 宝箱の中身が 1 つになる割合と、3 つまでになる割合（残りが 5 つ） */
export function chestOdds(h: number): { one: number; three: number } {
  const t = Math.max(0, (h - 2) / 7);
  return { one: 0.85 - 0.35 * t, three: 0.98 - 0.13 * t };
}

export function maxHeat(coins: number): number {
  let h = 2;
  while (h < HEAT_MAX && betOf(snap(h + 0.1)) <= coins) h = snap(h + 0.1);
  return h;
}

export function heatStage(s: Stage, h: number): Stage {
  if (h === 2) return s;
  const hp = hpMul(h);
  return {
    ...s,
    coin: s.coin * coinMul(h),
    toughness: (t) => s.toughness(t) * hp,
    chiefs: s.chiefs.map((c) => ({ ...c, hp: c.hp * hp }))
  };
}
