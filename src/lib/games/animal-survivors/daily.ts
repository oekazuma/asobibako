import type { AnimalId } from './animals';
import type { Stats } from './passives';
import { rng } from './rng';
import { stageOf } from './stages';
import type { Stage } from './stages/forest';
import type { Perks } from './upgrades';

export type ModId =
  'tough' | 'fury' | 'swarm' | 'bossHp' | 'noShop' | 'noMeat' | 'halfHp' | 'oneWeapon' | 'noTools' | 'growth' | 'might';

/** good はうれしい変化（コインを減らす）。お題の 1 つめには選ばない */
export const MODS: Record<ModId, { name: string; text: string; coins: number; good?: boolean }> = {
  tough: { name: '敵が硬い', text: '敵の体力 1.5 倍', coins: 200 },
  fury: { name: '敵の攻撃が痛い', text: '敵の攻撃 1.4 倍', coins: 200 },
  swarm: { name: '敵が多い', text: '敵の出る速さ 1.4 倍', coins: 50 },
  bossHp: { name: 'ボスが硬い', text: 'ボスの体力 1.6 倍', coins: 150 },
  noShop: { name: '店の強化なし', text: 'パワーアップが効かない', coins: 500 },
  noMeat: { name: '肉が出ない', text: '回復の肉が出ない', coins: 150 },
  halfHp: { name: 'HP 半分', text: '最大 HP が半分', coins: 200 },
  oneWeapon: { name: '武器は 1 つだけ', text: '最初の武器しか持てない', coins: 500 },
  noTools: { name: '道具なし', text: '引き直す・飛ばす・除外が使えない', coins: 100 },
  growth: { name: '経験値 2 倍', text: '経験値が 2 倍', coins: -200, good: true },
  might: { name: '攻撃アップ', text: '攻撃 +30%', coins: -200, good: true }
};

export interface Daily {
  date: string;
  animal: AnimalId;
  stage: string;
  mods: ModId[];
  cleared: boolean;
}

/** createWorld に渡すお題の回の中身 */
export interface Challenge {
  date: string;
  bonus: number;
  mods: ModId[];
}

/** 端末の時計の日付（その土地の日付で切り替える） */
export function todayKey(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** 日付から作った乱数で、候補の動物と面からお題を選ぶ。同じ日付と候補なら同じお題 */
export function makeDaily(date: string, animals: AnimalId[], stages: string[]): Daily {
  const r = rng(hash(date));
  const one = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const ids = Object.keys(MODS) as ModId[];
  const first = one(ids.filter((id) => !MODS[id].good));
  // 店の強化なしと武器 1 つだけは、どちらか 1 つでもボットのクリアが 1 割台に落ちるので重ねない
  const heavy = (id: ModId) => id === 'noShop' || id === 'oneWeapon';
  return {
    date,
    animal: one(animals),
    stage: one(stages),
    mods: [first, one(ids.filter((id) => id !== first && !(heavy(first) && heavy(id))))],
    cleared: false
  };
}

export function dailyBonus(d: Pick<Daily, 'stage' | 'mods'>): number {
  const sum = 200 + d.mods.reduce((t, id) => t + MODS[id].coins, 0);
  return Math.max(200, Math.round((sum * stageOf(d.stage).coin) / 10) * 10);
}

/** 敵の出る数を k 倍にした面の表の写し */
export function swarmStage(s: Stage, k: number): Stage {
  if (k === 1) return s;
  return {
    ...s,
    waves: s.waves.map((v) => ({ ...v, rate: [v.rate[0] * k, v.rate[1] * k] })),
    cap: (t) => Math.min(400, Math.round(s.cap(t) * k))
  };
}

/** 面の表を変えるしばり。元の表は次の回も使うので写してから変える */
export function modStage(s: Stage, mods: ModId[]): Stage {
  if (!mods.some((id) => id === 'tough' || id === 'fury' || id === 'swarm' || id === 'bossHp')) return s;
  const k = (id: ModId, v: number) => (mods.includes(id) ? v : 1);
  return {
    ...swarmStage(s, k('swarm', 1.4)),
    toughness: (t) => s.toughness(t) * k('tough', 1.5),
    fury: (t) => s.fury(t) * k('fury', 1.4),
    bosses: s.bosses.map((b) => ({ ...b, hp: (b.hp ?? 1) * k('bossHp', 1.6) }))
  };
}

/** HP 半分のしばりの最大 HP の倍率。育つ・パッシブで増えるぶんも半分にするので stats() の最後に掛ける */
export const hpScale = (mods: ModId[]) => (mods.includes('halfHp') ? 0.5 : 1);

/** 自分にかかるしばり。店の強化なしは呼ぶ側が店の段を空にしてから perks を作る */
export function modPerks(k: Perks, mods: ModId[]): Perks {
  const boost: Partial<Stats> = { ...k.boost };
  const add = (key: keyof Stats, v: number) => (boost[key] = (boost[key] ?? 0) + v);
  if (mods.includes('growth')) add('growth', 1);
  if (mods.includes('might')) add('might', 0.3);
  const tools = mods.includes('noTools') ? { rerolls: 0, skips: 0, banishes: 0 } : {};
  return { ...k, ...tools, boost };
}
