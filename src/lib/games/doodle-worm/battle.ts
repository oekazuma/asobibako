import type { Creature, Kind, Role } from './engine';

/**
 * バトルの決まりごと。DOM も canvas も使わない。戦いは自動で進み、応援（連打）でゲージがたまるほど強く当たる。
 * 強さは絵の形で少しだけ変わる（大きい体は体力、足は速さ、はねはよける、しっぽは力、頭の上の線は会心）。
 * 差は連打でひっくり返せる程度にとどめる
 */

export interface Stats {
  hp: number;
  /** 1 回の攻撃の強さ */
  power: number;
  /** 攻撃のあいだの秒 */
  interval: number;
  /** よける確率 */
  dodge: number;
  /** 会心（2 倍）の確率 */
  crit: number;
  kind: Kind;
  /** いちばん目立つ持ち味。名札に出す */
  trait: string;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function stats(c: Creature): Stats {
  const count = (role: Role) => Math.min(2, c.parts.filter((p) => p.role === role).length);
  const big = clamp01((c.r - 0.04) / 0.08);
  const [legs, wings, tails, tops] = [count('leg'), count('arm'), count('tail'), count('top')];
  const s = {
    hp: Math.round(100 + big * 40),
    power: 9 + tails * 2,
    interval: 1.5 - legs * 0.15,
    dodge: 0.05 + wings * 0.06,
    crit: 0.05 + tops * 0.07,
    kind: c.kind
  };
  const marks: [number, string][] = [
    [big * 2, 'でっかい'],
    [legs, 'すばやい'],
    [wings, 'ひらひら'],
    [tails, 'ちからもち'],
    [tops, 'ラッキー']
  ];
  const [score, trait] = marks.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { ...s, trait: score > 0.5 ? trait : 'げんき' };
}

/** 選ぶ画面に出す、持ち味ごとの 0..1 の目盛り。stats の取りうる幅を 0..1 に広げる */
export function ratings(s: Stats): [string, number][] {
  const k = (v: number, lo: number, hi: number) => clamp01(0.15 + (0.85 * (v - lo)) / (hi - lo));
  return [
    ['たいりょく', k(s.hp, 100, 140)],
    ['パワー', k(s.power, 9, 13)],
    ['すばやさ', k(1.5 - s.interval, 0, 0.3)],
    ['よける', k(s.dodge, 0.05, 0.17)],
    ['かいしん', k(s.crit, 0.05, 0.19)]
  ];
}

/** 1 回の連打でたまるゲージ。17 回ほどで満タン */
export const CHEER = 0.06;
/** ゲージは連打をやめると減る（1 秒あたり） */
const DRAIN = 0.12;
/** ひっさつわざの強さの倍率 */
const SPECIAL = 2.5;
/** ひっさつわざを出したあとに残るゲージ */
const AFTER_SPECIAL = 0.3;
/** 攻撃の構えから当たるまでの秒。当たるまでの動きは描く側が act.t で決める */
export const WINDUP = 0.35;
/** 攻撃を出して戻るまでの秒 */
export const ACT = 0.7;
/** これを過ぎたら残りの体力の割合で決める */
export const TIME_LIMIT = 45;
/** 「ファイト！」までの秒 */
export const READY = 1.6;

export interface Side {
  stats: Stats;
  hp: number;
  gauge: number;
  /** 次の攻撃までの秒 */
  timer: number;
  /** 攻撃の最中。t は出してからの秒 */
  act: { t: number; special: boolean; hit: boolean } | null;
  /** 攻撃を受けてからの秒。受けていなければ -1 */
  hurt: number;
}

export type FightEvent =
  | { type: 'go' }
  | { type: 'hit'; side: 0 | 1; damage: number; special: boolean; crit: boolean }
  | { type: 'dodge'; side: 0 | 1 }
  | { type: 'ready'; side: 0 | 1 }
  | { type: 'end'; winner: 0 | 1 };

/** 自動で進む 1 戦。side はどちらも 0 が手前（1P） */
export class Fight {
  readonly sides: [Side, Side];
  t = -READY;
  winner: 0 | 1 | null = null;
  readonly #rand: () => number;

  constructor(a: Stats, b: Stats, rand = Math.random) {
    this.#rand = rand;
    // 同時に殴り合わないよう、最初の攻撃をずらす
    this.sides = [a, b].map((stats, i): Side => ({
      stats,
      hp: stats.hp,
      gauge: 0,
      timer: 0.4 + i * 0.5 + rand() * 0.3,
      act: null,
      hurt: -1
    })) as [Side, Side];
  }

  get started(): boolean {
    return this.t >= 0;
  }

  /** 応援。始まる前と決着のあとは数えない */
  cheer(side: 0 | 1): FightEvent[] {
    if (!this.started || this.winner !== null) return [];
    const s = this.sides[side];
    const was = s.gauge;
    s.gauge = Math.min(1, s.gauge + CHEER);
    return was < 1 && s.gauge >= 1 ? [{ type: 'ready', side }] : [];
  }

  step(dt: number): FightEvent[] {
    const out: FightEvent[] = [];
    const was = this.t;
    this.t += dt;
    if (was < 0 && this.t >= 0) out.push({ type: 'go' });
    if (!this.started || this.winner !== null) return out;
    for (const i of [0, 1] as const) {
      const s = this.sides[i];
      if (s.hurt >= 0) s.hurt = s.hurt + dt < 0.4 ? s.hurt + dt : -1;
      if (s.gauge < 1) s.gauge = Math.max(0, s.gauge - DRAIN * dt);
      if (s.act) {
        s.act.t += dt;
        if (!s.act.hit && s.act.t >= WINDUP) {
          s.act.hit = true;
          this.#land(i, s.act.special, out);
          if (this.winner !== null) return out;
        }
        if (s.act.t >= ACT) s.act = null;
        continue;
      }
      s.timer -= dt;
      if (s.timer > 0) continue;
      const special = s.gauge >= 1;
      if (special) s.gauge = AFTER_SPECIAL;
      s.act = { t: 0, special, hit: false };
      s.timer = s.stats.interval * (0.9 + this.#rand() * 0.2);
    }
    if (this.t >= TIME_LIMIT)
      this.#end(this.sides[0].hp / this.sides[0].stats.hp >= this.sides[1].hp / this.sides[1].stats.hp ? 0 : 1, out);
    return out;
  }

  /** 当たる強さは応援のゲージで 0.6〜1.8 倍 */
  #land(i: 0 | 1, special: boolean, out: FightEvent[]) {
    const s = this.sides[i];
    const foe = this.sides[(1 - i) as 0 | 1];
    if (!special && this.#rand() < foe.stats.dodge) {
      out.push({ type: 'dodge', side: (1 - i) as 0 | 1 });
      return;
    }
    const crit = !special && this.#rand() < s.stats.crit;
    const damage = Math.round(s.stats.power * (0.6 + 1.2 * s.gauge) * (special ? SPECIAL : crit ? 2 : 1));
    foe.hp = Math.max(0, foe.hp - damage);
    foe.hurt = 0;
    out.push({ type: 'hit', side: i, damage, special, crit });
    if (foe.hp === 0) this.#end(i, out);
  }

  #end(winner: 0 | 1, out: FightEvent[]) {
    this.winner = winner;
    this.sides.forEach((s) => (s.act = null));
    out.push({ type: 'end', winner });
  }
}

/**
 * 相手の応援。1 秒に rate 回ほど、少しむらを付けて押す。
 * ponytail: 押す間を乱数で散らすだけ。相手の性格（終盤に追い上げる など）が欲しくなったら足す
 */
export class Cheerer {
  #wait = 0;
  readonly rate: number;
  readonly #rand: () => number;

  constructor(rate: number, rand = Math.random) {
    this.rate = rate;
    this.#rand = rand;
  }

  /** dt のあいだに押した回数 */
  step(dt: number): number {
    let n = 0;
    this.#wait -= dt;
    while (this.#wait <= 0) {
      n++;
      this.#wait += (0.5 + this.#rand()) / this.rate;
    }
    return n;
  }
}
