import type { CoopRun } from './world';

const TITLES = [
  ['kills', 'いちばん倒した'],
  ['damage', 'いちばんダメージ'],
  ['raises', 'いちばん助けた']
] as const;

/** 動物ごとの称号。多いほうに付け、同じ数（どちらも 0 も）なら付けない */
export function titles(c: CoopRun): string[][] {
  const out: string[][] = c.heroes.map(() => []);
  for (const [k, name] of TITLES) {
    const [a, b] = c.heroes.map((h) => h[k]);
    if (a > b) out[0].push(name);
    else if (b > a) out[1].push(name);
  }
  return out;
}
