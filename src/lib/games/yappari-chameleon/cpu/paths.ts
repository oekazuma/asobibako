import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';

/**
 * 探す CPU の歩く網の点。動く物の置き場所の候補（props.ts の SETS）のどれにもかからない所に置き、どの 2 点のあいだも
 * まっすぐ歩けるものだけを辺にする（paths.test.ts が候補の全部に物を置いた屋敷で歩かせて見る）
 */
export const NODES = {
  entrance: [0, 0, 0.6],
  hall: [0, 0, 2.2],
  hallWest: [-2, 0, 2.2],
  hallWestMid: [-2, 0, 5],
  westDoor: [-6.6, 0, 5],
  eastDoor: [6.2, 0, 6],
  stairTop: [0, 3.5, 9.6],
  galleryWest: [-4, 3.5, 10.5],
  galleryEast: [4, 3.5, 10.5],
  corridorEast: [-8.5, 0, 5],
  corridor: [-15.5, 0, 5],
  corridorWest: [-21.5, 0, 5],
  kitchenDoor: [-16, 0, 6.2],
  kitchen: [-16, 0, 8],
  kitchenWest: [-17.5, 0, 11],
  kitchenEast: [-13, 0, 11],
  kitchenNorth: [-15, 0, 13.2],
  laundryDoor: [-15, 0, 4],
  laundry: [-15, 0, 2.2],
  laundryEast: [-12, 0, 0],
  laundrySouthEast: [-11.8, 0, -3.4],
  laundryWest: [-18.6, 0, 1.6],
  laundrySouthWest: [-18, 0, -1.6],
  studyDoor: [8, 0, 6],
  studySouth: [12.25, 0, 4.2],
  studyNorth: [12.25, 0, 7.6],
  studyEast: [15.2, 0, 6]
} satisfies Record<string, V3>;

export type Node = keyof typeof NODES;

export const EDGES: [Node, Node][] = [
  ['entrance', 'hall'],
  ['hall', 'hallWest'],
  ['hallWest', 'hallWestMid'],
  ['hallWestMid', 'westDoor'],
  ['westDoor', 'corridorEast'],
  ['hall', 'eastDoor'],
  ['eastDoor', 'studyDoor'],
  ['hall', 'stairTop'],
  ['stairTop', 'galleryWest'],
  ['stairTop', 'galleryEast'],
  ['corridorEast', 'corridor'],
  ['corridor', 'corridorWest'],
  ['corridor', 'kitchenDoor'],
  ['kitchenDoor', 'kitchen'],
  ['kitchen', 'kitchenWest'],
  ['kitchen', 'kitchenEast'],
  ['kitchenWest', 'kitchenNorth'],
  ['kitchenEast', 'kitchenNorth'],
  ['corridor', 'laundryDoor'],
  ['laundryDoor', 'laundry'],
  ['laundry', 'laundryEast'],
  ['laundryEast', 'laundrySouthEast'],
  ['laundry', 'laundryWest'],
  ['laundryWest', 'laundrySouthWest'],
  ['studyDoor', 'studySouth'],
  ['studyDoor', 'studyNorth'],
  ['studySouth', 'studyEast'],
  ['studyNorth', 'studyEast']
];

/**
 * 見回る順の部屋。toward は見回すときに向く奥（左右へ振る中心）。low は机・台・棚の下をのぞける部屋
 * （強い CPU は、この部屋の見回しでだけしゃがむ）
 */
export const ROOMS: { name: string; look: Node; toward: V3; low: boolean }[] = [
  { name: '大広間', look: 'hall', toward: [0, 1, 7], low: false },
  { name: '2階の回廊', look: 'stairTop', toward: [0, 4, 11], low: false },
  { name: '書斎', look: 'studySouth', toward: [12.25, 1, 8], low: true },
  { name: '緑の廊下', look: 'corridor', toward: [-21, 1, 5], low: false },
  { name: 'キッチン', look: 'kitchen', toward: [-16, 1, 12], low: true },
  { name: 'ランドリー', look: 'laundry', toward: [-15, 1, -2], low: true }
];

// 回廊の下の床と回廊の上の点を取り違えないよう、高さの差は大きく数える
const far = (a: V3, b: V3) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 3, a[2] - b[2]);
const ALL = Object.keys(NODES) as Node[];

/** at にいちばん近い点。同じ部屋の点を先に見る（壁ぎわでは壁の向こうの点のほうが近いことがある） */
export function nearest(at: V3): Node {
  const place = placeOf(at);
  const same = ALL.filter((n) => placeOf(NODES[n]) === place);
  return (same.length ? same : ALL).reduce((a, b) => (far(NODES[a], at) <= far(NODES[b], at) ? a : b));
}

export function route(from: Node, to: Node, blocked: ReadonlySet<string> = new Set()): Node[] {
  const best = new Map<Node, number>([[from, 0]]);
  const back = new Map<Node, Node>();
  const open: Node[] = [from];
  while (open.length) {
    open.sort((a, b) => best.get(a)! - best.get(b)!);
    const n = open.shift()!;
    if (n === to) break;
    for (const [a, b] of EDGES)
      for (const [p, q] of [
        [a, b],
        [b, a]
      ] as const) {
        if (p !== n || blocked.has(`${p}>${q}`)) continue;
        const d = best.get(n)! + far(NODES[p], NODES[q]);
        if (d >= (best.get(q) ?? Infinity)) continue;
        best.set(q, d);
        back.set(q, n);
        if (!open.includes(q)) open.push(q);
      }
  }
  if (!best.has(to)) return [];
  const out: Node[] = [to];
  while (out[0] !== from) out.unshift(back.get(out[0])!);
  return out;
}
