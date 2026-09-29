// ダンスのハイスコア。曲と難しさごとに、いちばん良かった点数とランクを覚える
import type { Difficulty, Result } from './dance';

export const BEST_KEY = 'asobibako:doodle-worm:dance';

export type Best = Record<string, { score: number; rank: Result['rank'] }>;

export const bestKey = (song: string, d: Difficulty) => `${song}:${d}`;

export function loadBest(): Best {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Best) : {};
  } catch {
    return {};
  }
}

/** 前より良ければ覚えて fresh を立てる。保存できない環境でも、その場の表示は新しい記録にする */
export function saveBest(best: Best, key: string, r: Result): { best: Best; fresh: boolean } {
  if ((best[key]?.score ?? -1) >= r.score) return { best, fresh: false };
  const next = { ...best, [key]: { score: r.score, rank: r.rank } };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    // 使えない環境では覚えない
  }
  return { best: next, fresh: true };
}
