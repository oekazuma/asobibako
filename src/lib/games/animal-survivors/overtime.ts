import { overtimeCoins } from './drops';
import { RAGE, type Stage } from './stages/forest';
import { summary, type RunSummary, type World } from './world';

/** 延長戦に入ってから 1 分ごとに、硬さと攻撃の強さに足す割合 */
export const RAMP = 0.6;
/** 延長戦のボスは 1 分ごと。誰も届かない長さまで行を用意しておく */
const BOSS_EVERY = 60;
const BOSS_ROWS = 60;

/** クリアのあとに続ける。面の表は写してから変える（元の表は次の回も使う） */
export function startOvertime(w: World): void {
  const s = w.stage;
  const from = s.length;
  const ramp = (f: (t: number) => number) => (t: number) => f(t) * (1 + (RAMP * Math.max(0, t - from)) / 60);
  // その面のボスを出た順に繰り返す（1 面は 6 体、墓地・雪山・火山は 2 体）
  const ids = [...new Set(s.bosses.map((r) => r.id))];
  const bosses: Stage['bosses'] = Array.from({ length: BOSS_ROWS }, (_, k) => ({
    at: from + BOSS_EVERY * (k + 1),
    id: ids[k % ids.length],
    hp: 1.5,
    rage: RAGE
  }));
  // クリアまでのボスはもう出ている。時刻を飛ばしたときに延長戦の 1 体めの前にまとめて出さない
  w.warned = w.bossNext = s.bosses.length;
  w.stage = {
    ...s,
    length: Infinity,
    // クリアの時刻で終わる行は、終わる直前の速さのまま続ける
    waves: s.waves.map((v) => (v.to >= from ? { ...v, from, to: Infinity, rate: [v.rate[1], v.rate[1]] } : v)),
    bosses: [...s.bosses, ...bosses],
    toughness: ramp(s.toughness),
    fury: ramp(s.fury)
  };
  w.overtime = {
    from,
    base: {
      kills: w.kills,
      opened: w.opened,
      killsBy: { ...w.killsBy },
      bossTimes: w.bossTimes.length,
      lavaKills: w.lavaKills,
      tickets: [...w.tickets]
    },
    coins: 0,
    retreat: false
  };
  w.over = null;
}

/** 延長戦の終わりに記録へ渡す、延長戦に入ってからの差。クリアはクリアの時刻で記録してある */
export function overtimeRun(w: World): RunSummary {
  const s = summary(w);
  const base = w.overtime!.base;
  const kills: Record<string, number> = {};
  for (const [id, n] of Object.entries(w.killsBy)) {
    const d = n - (base.killsBy[id] ?? 0);
    if (d > 0) kills[id] = d;
  }
  const got = w.tickets.map((n, i) => n - base.tickets[i]);
  const keep = w.overtime!.retreat;
  return {
    ...s,
    tickets: keep ? got : [0, 0, 0],
    lost: keep ? [0, 0, 0] : got,
    cleared: false,
    finale: false,
    metal: false,
    // 「1 回で N 体」の実績は回の合計を見るので、倒した数は合計のまま渡し、記録には差だけを足させる
    kills: w.kills,
    killsBefore: base.kills,
    opened: w.opened - base.opened,
    lavaKills: w.lavaKills - base.lavaKills,
    coins: overtimeCoins(w),
    book: { ...s.book, kills, bosses: s.book.bosses.slice(base.bossTimes) }
  };
}
