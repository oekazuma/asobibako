import { overtimeCoins } from './drops';
import { RAGE, type Stage } from './stages/forest';
import { summary, type RunSummary, type World } from './world';

/**
 * 延長戦の敵の硬さと攻撃の伸び。1 分ごとに OT_EARLY を足す伸びと OT_GROW を掛ける伸びの速いほうで強める。
 * 足すほうだけでは全部そろえた動物が倒れず、掛けるほうだけでは序盤がやさしすぎる（27 分ほどで入れ替わる）
 */
export const OT_EARLY = 0.4;
export const OT_GROW = 1.12;
export const otScale = (t: number, from: number) => {
  const m = Math.max(0, t - from) / 60;
  return Math.max(1 + OT_EARLY * m, OT_GROW ** m);
};
/** 延長戦のボスは 1 分ごと。誰も届かない長さまで行を用意しておく */
const BOSS_EVERY = 60;
const BOSS_ROWS = 60;

/** クリアのあとに続ける。面の表は写してから変える（元の表は次の回も使う） */
export function startOvertime(w: World): void {
  const s = w.stage;
  const from = s.length;
  const ramp = (f: (t: number) => number) => (t: number) => f(t) * otScale(t, from);
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
      tickets: [...w.tickets],
      links: w.link.uses,
      raises: w.heroes.map((h) => h.raises)
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
    book: { ...s.book, kills, bosses: s.book.bosses.slice(base.bossTimes) },
    // 記録は 10:00 のクリアで 1 度入れているので、2 度めは延長戦のぶんの差だけにする
    ...(s.coop && {
      coop: {
        ...s.coop,
        links: s.coop.links - base.links,
        carries: 0,
        heroes: s.coop.heroes.map((h, i) => ({ ...h, raises: h.raises - (base.raises[i] ?? 0) })),
        bonus: 0
      }
    })
  };
}
