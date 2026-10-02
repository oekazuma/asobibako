import { ACHIEVEMENTS, grant, type AchievementDef } from './achievements';
import { ANIMALS, type AnimalId } from './animals';
import type { BossId } from './enemies';
import { UPGRADES, type Ranks } from './upgrades';
import type { RunSummary } from './world';

export interface Records {
  /** いちばん長い生存時間（秒） */
  best: number;
  /** 撃破数の合計 */
  kills: number;
  bosses: BossId[];
  clears: number;
  unlocked: AnimalId[];
  /** もちもののコイン */
  coins: number;
  /** 店の品ごとの段 */
  ranks: Ranks;
  /** 達成した実績の id */
  achieved: string[];
  /** クリアした動物 */
  clearedBy: AnimalId[];
  /** 開けた宝箱の合計 */
  chests: number;
}

export const RECORDS_KEY = 'asobibako:animal-survivors';
const STARTERS: AnimalId[] = ['dog', 'cat', 'wolf'];
const BOSSES: BossId[] = ['bear', 'spiderQueen'];

export function emptyRecords(): Records {
  return {
    best: 0,
    kills: 0,
    bosses: [],
    clears: 0,
    unlocked: [...STARTERS],
    coins: 0,
    ranks: {},
    achieved: [],
    clearedBy: [],
    chests: 0
  };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const list = <T extends string>(v: unknown, known: readonly T[]): T[] =>
  Array.isArray(v) ? known.filter((k) => v.includes(k)) : [];

/** 壊れた保存や型の違う値は既定値にする。犬・猫・狼はいつも選べる */
export function parseRecords(text: string | null): Records {
  let raw: Record<string, unknown> = {};
  try {
    const v: unknown = text ? JSON.parse(text) : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) raw = v as Record<string, unknown>;
  } catch {
    // 壊れた保存は空の記録として読む
  }
  const ids = ANIMALS.map((a) => a.id);
  const unlocked = list(raw.unlocked, ids);
  return {
    best: num(raw.best),
    kills: num(raw.kills),
    bosses: list(raw.bosses, BOSSES),
    clears: num(raw.clears),
    unlocked: ids.filter((id) => STARTERS.includes(id) || unlocked.includes(id)),
    coins: Math.floor(num(raw.coins)),
    ranks: ranksOf(raw.ranks),
    achieved: list(
      raw.achieved,
      ACHIEVEMENTS.map((a) => a.id)
    ),
    clearedBy: list(raw.clearedBy, ids),
    chests: Math.floor(num(raw.chests))
  };
}

/** 知らない品と数でない段は読み飛ばし、段は 0〜最大の整数にする */
function ranksOf(v: unknown): Ranks {
  const out: Ranks = {};
  if (!v || typeof v !== 'object') return out;
  for (const d of UPGRADES) {
    const n = Math.min(d.max, Math.floor(num((v as Record<string, unknown>)[d.id])));
    if (n > 0) out[d.id] = n;
  }
  return out;
}

/** 1 回の結果で記録を足し、その回に達成した実績を返す。解放は取り消さない */
export function record(r: Records, run: RunSummary): AchievementDef[] {
  r.best = Math.max(r.best, run.time);
  r.kills += run.kills;
  for (const b of run.bosses) if (!r.bosses.includes(b)) r.bosses.push(b);
  if (run.cleared) {
    r.clears += 1;
    if (!r.clearedBy.includes(run.animal)) r.clearedBy.push(run.animal);
  }
  r.chests += run.opened;
  r.coins += run.coins;
  return grant(r, run);
}

/** 保存が使えない端末（プライベートブラウズなど）では空の記録を返す */
export function loadRecords(): Records {
  try {
    return parseRecords(localStorage.getItem(RECORDS_KEY));
  } catch {
    return emptyRecords();
  }
}

export function saveRecords(r: Records): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    // 保存できなくても遊び続けられるようにする
  }
}
