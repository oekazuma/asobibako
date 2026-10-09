import type { V3 } from '$lib/sculpt';
import { rng } from '../rng';
import type { Piece } from './layout';

export type Turn = Piece['turn'];

export interface Slot {
  at: V3;
  turn: Turn;
}

/** 動く物の組。units の 1 つずつを slots のどれかに置く（slots は units より多い）。物の部品は候補から見た位置と向き */
export interface PropSet {
  units: Piece[][];
  slots: Slot[];
}

const P = (kind: Piece['kind'], at: V3 = [0, 0, 0], turn: Turn = 0): Piece => ({ kind, at, turn });
const S = (x: number, z: number, turn: Turn = 0): Slot => ({ at: [x, 0, z], turn });
const one = (kind: Piece['kind']): Piece[] => [P(kind)];
const WHITE_TABLE = [
  P('table-white'),
  P('chair', [0, 0, -0.9]),
  P('chair', [0, 0, 0.9], 2),
  P('chair', [-0.9, 0, 0], 1),
  P('chair', [0.9, 0, 0], 3)
];
const RED_TABLE = [P('table-red'), P('chair', [0, 0, -0.9]), P('chair', [0, 0, 0.9], 2)];

/**
 * 部屋ごとの動く物と置き場所の候補。候補どうし・壁や動かない家具・戸口の通り道（rooms.ts の DOORWAYS）・
 * 始める場所に重ならない位置に選んであり、どの組み合わせで置いてもかぶらない（props.test.ts が見る）
 */
export const SETS: PropSet[] = [
  { units: [WHITE_TABLE, RED_TABLE], slots: [S(-4, 2.5), S(-4.5, 7), S(4.5, 7.2), S(-3.8, 10.6)] },
  { units: [one('balloons'), one('balloons')], slots: [S(-6.2, 0.8), S(6.2, 11.2), S(6.2, 0.8), S(-6.3, 11.3)] },
  {
    units: [one('balloon'), one('balloon'), one('balloon')],
    slots: [S(1.8, 1.2), S(2.4, 1.5), S(-1.5, 10.5), S(3.2, 10.8), S(-2.4, 0.9), S(5.6, 9.6)]
  },
  { units: [one('sofa'), one('bench')], slots: [S(-14, 6.3, 2), S(-20, 3.7), S(-10.5, 6.3, 2), S(-19.5, 6.3, 2)] },
  {
    units: [one('balloon'), one('balloon'), one('balloon')],
    slots: [S(-12, 4), S(-12.5, 4.3), S(-18, 5.8), S(-9.6, 4), S(-21.8, 3.8)]
  },
  {
    units: [one('folding-chair'), one('folding-chair')],
    slots: [S(12.25, 6.85, 2), S(12.25, 5.15), S(9, 2.1, 1), S(16.2, 6, 3), S(8.6, 9.4, 1)]
  },
  {
    units: [one('book-pile'), one('book-pile'), one('book-pile')],
    slots: [S(9.4, 10.2), S(13, 10.25), S(16.3, 10.1), S(11, 1.4), S(15, 4.6)]
  },
  {
    units: [one('box'), one('box'), one('box')],
    slots: [S(-12, 9), S(-12, 10), S(-19.9, 13.6), S(-13, 8), S(-18.3, 8)]
  },
  { units: [one('bucket'), one('bucket')], slots: [S(-13.6, 14.6), S(-20.4, 8), S(-12.6, 12.4), S(-18.2, 12)] },
  {
    units: [one('towels'), one('towels'), one('towels')],
    slots: [S(-11, -4.6), S(-11, -3.6), S(-13, -4.6), S(-19.5, 1), S(-13.5, 1.6)]
  },
  { units: [one('cart')], slots: [S(-12.5, -2, 1), S(-17, 0.5), S(-18.6, -2.4, 1)] },
  { units: [one('bucket'), one('bucket')], slots: [S(-16, -4.6), S(-10.6, 1.8), S(-19.6, -3.2), S(-14, -1)] }
];

/** slot に置いたときの piece。piece の位置と向きを slot の向きだけ回す（three の rotation.y と同じ回り方） */
export function place(slot: Slot, q: Piece): Piece {
  const [x, y, z] = q.at;
  const [dx, dz] = [
    [x, z],
    [z, -x],
    [-x, -z],
    [-z, x]
  ][slot.turn];
  return { ...q, at: [slot.at[0] + dx, slot.at[1] + y, slot.at[2] + dz], turn: ((q.turn + slot.turn) % 4) as Turn };
}

/** 組ごとに、units の i 番めを置く候補。種が null なら候補の頭から順に（既定の置き方） */
export function arrange(seed: number | null): Slot[][] {
  const rand = seed === null ? null : rng(seed);
  return SETS.map((set) => {
    const order = set.slots.map((_, i) => i);
    if (rand)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    return set.units.map((_, i) => set.slots[order[i]]);
  });
}

/** 置いた動く物の部品。並びは組 → 物 → 部品の順で、種が変わっても数と並びは同じ */
export function propPieces(seed: number | null): Piece[] {
  const slots = arrange(seed);
  return SETS.flatMap((set, k) => set.units.flatMap((unit, i) => unit.map((q) => place(slots[k][i], q))));
}

/** 額の絵柄の数（textures-rooms.ts の artwork） */
export const ART = 4;

/** n 枚の額の絵柄。置き方とは別の乱数の流れで決め、種が null なら 0, 1, 2… の順 */
export function artOf(seed: number | null, n: number): number[] {
  const rand = seed === null ? null : rng(seed ^ 0x5bd1e995);
  return Array.from({ length: n }, (_, i) => (rand ? Math.floor(rand() * ART) : i % ART));
}
