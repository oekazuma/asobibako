import type { Spot } from './layout';

/**
 * リードのおさんぽの道と、道で起きることの並べ方。DOM も three も使わない。
 * 道は z = 0 から -LENGTH へまっすぐのびる歩道で、x が右（車道の側）。単位はメートル
 */

export const LENGTH = 70;
/** 歩道の左右のふち。右のふちの外が縁石と車道 */
export const SIDEWALK = { x0: -1.3, x1: 1.3 };
/** 横道の真ん中の z と、道はばの半分。ここには電柱や消火栓を置かない */
export const CROSSING = { z: -34, half: 3.5 };
/** 電柱の z。歩道と柵のあいだの芝に立つ（車道の側に立てると、道を見通すカメラの前をふさぐ） */
export const POLES = [-8, -21, -47, -60];
export const POLE_X = -1.7;
const HYDRANT_X = 1.05;
/** 出来事どうしの z の間。近いとペットが次々と寄り道して前へ進まない */
export const GAP = 3;

export type StopKind = 'pole' | 'hydrant' | 'smell' | 'present' | 'dog' | 'poop';

export interface Stop extends Spot {
  kind: StopKind;
  /** 電柱と消火栓で、おしっこをするか */
  pee?: boolean;
}

const inCrossing = (z: number) => Math.abs(z - CROSSING.z) < CROSSING.half + 1;

/** 道で起きることを奥へ向かう順に並べる。電柱は決まった所、ほかは乱数で散らす */
export function plan(rng: () => number): Stop[] {
  const stops: Stop[] = POLES.map((z) => ({ kind: 'pole', x: POLE_X, z }));
  const place = (kind: StopKind, x: () => number, from = -6) => {
    for (let i = 0; i < 100; i++) {
      const z = from - rng() * (LENGTH - 6 + from);
      if (inCrossing(z) || stops.some((s) => Math.abs(s.z - z) < GAP)) continue;
      stops.push({ kind, x: x(), z });
      return;
    }
  };
  // 道が混んで置けないときは、あとから置くものを減らす
  // ほかの犬は、歩きはじめてすぐと、横道を渡ったあとに 1 匹ずつ
  place('dog', () => 0, -12);
  place('dog', () => 0, CROSSING.z - CROSSING.half - 2);
  place('poop', () => 0, -14);
  for (let i = 0; i < 3; i++) place('present', () => -0.6 + rng() * 1.2);
  for (let i = 0; i < 2; i++) place('hydrant', () => HYDRANT_X);
  for (let i = 0; i < 2; i++) place('smell', () => SIDEWALK.x0 + 0.15);
  stops.sort((a, b) => b.z - a.z);
  // 最初の電柱か消火栓では必ず、あとは半分ほどでおしっこをする
  let first = true;
  for (const s of stops) {
    if (s.kind !== 'pole' && s.kind !== 'hydrant') continue;
    s.pee = first || rng() < 0.5;
    first = false;
  }
  return stops;
}

/** リードの長さより離れたら、ペットを手元の方へ引き寄せた位置 */
export function tether(pet: Spot, hand: Spot, length: number): Spot {
  const d = Math.hypot(pet.x - hand.x, pet.z - hand.z);
  if (d <= length) return pet;
  const k = length / d;
  return { x: hand.x + (pet.x - hand.x) * k, z: hand.z + (pet.z - hand.z) * k };
}
