import type { Seg } from '$lib/segments';
import { difficulty, lerp, Rng } from '$lib/levels';
import meta from './meta';
import { GROUND, type Level, type Pet, type Point, type Zone } from './engine';

const DOG_Y = GROUND - 0.075;
const FLOOR = GROUND - 0.005;

/** solution はクリアできる線。テストでこの線を引けばクリアでき、引かなければ刺されることを確かめる */
export interface Stage extends Level {
  solution: Point[];
  kind: Kind;
}

type Kind = 'open' | 'open2' | 'cave' | 'cave2' | 'side' | 'platform' | 'platform2' | 'mixed';

interface Layout {
  pets: Point[];
  walls: Seg[];
  noDraw: Zone[];
  solution: Point[];
  /** 巣を置かない場所（洞窟の中など） */
  low: boolean;
  side?: 'left' | 'right';
  tip: string;
}

/**
 * 床（y = floor）に立つ犬を、半径 r の半円で覆う線。2 つのドームをつなぐときは足場の端の上を通す
 * （端の下をくぐる線は足場と交わったまま落ちて、はじき飛ばされる）
 */
function dome(x: number, floor: number, r: number): Point[] {
  return Array.from({ length: 21 }, (_, i) => {
    const a = (i / 20) * Math.PI;
    return { x: x - Math.cos(a) * r, y: floor - Math.sin(a) * r };
  });
}

const line = (...pts: [number, number][]): Point[] => pts.map(([x, y]) => ({ x, y }));

/** 天井に穴のある洞窟。cx が真ん中、w が幅、o が穴の幅 */
function cave(cx: number, w: number, o: number, top: number): Seg[] {
  return [
    [cx - w / 2, top, cx - w / 2, GROUND],
    [cx + w / 2, top, cx + w / 2, GROUND],
    [cx - w / 2, top, cx - o / 2, top],
    [cx + o / 2, top, cx + w / 2, top]
  ];
}

const LAYOUTS: Record<Kind, (rng: Rng) => Layout> = {
  open: (rng) => {
    const x = rng.range(0.25, 0.75);
    return {
      pets: [{ x, y: DOG_Y }],
      walls: [],
      noDraw: [],
      solution: dome(x, FLOOR, 0.18),
      low: false,
      tip: '線で かこんで まもろう'
    };
  },
  open2: (rng) => {
    const [a, b] = [rng.range(0.18, 0.33), rng.range(0.67, 0.82)];
    return {
      pets: [
        { x: a, y: DOG_Y },
        { x: b, y: DOG_Y }
      ],
      walls: [],
      noDraw: [],
      solution: [...dome(a, FLOOR, 0.17), ...dome(b, FLOOR, 0.17)],
      low: false,
      tip: '2ひきとも 1本の線で まもろう'
    };
  },
  cave: (rng) => {
    const cx = rng.range(0.3, 0.7);
    const o = rng.range(0.1, 0.16);
    const top = rng.range(0.94, 1.02);
    return {
      pets: [{ x: cx + rng.range(-0.05, 0.05), y: DOG_Y }],
      walls: cave(cx, rng.range(0.34, 0.42), o, top),
      noDraw: [],
      solution: line([cx - o / 2 - 0.05, top - 0.025], [cx + o / 2 + 0.05, top - 0.025]),
      low: false,
      tip: 'インクが少ない！ 天井の穴だけ ふさごう'
    };
  },
  cave2: (rng) => {
    const top = rng.range(0.94, 1.02);
    const [a, b] = [rng.range(0.24, 0.28), rng.range(0.72, 0.76)];
    const [oa, ob] = [rng.range(0.1, 0.14), rng.range(0.1, 0.14)];
    return {
      pets: [
        { x: a, y: DOG_Y },
        { x: b, y: DOG_Y }
      ],
      walls: [...cave(a, 0.38, oa, top), ...cave(b, 0.38, ob, top)],
      noDraw: [],
      solution: line([a - oa / 2 - 0.05, top - 0.025], [b + ob / 2 + 0.05, top - 0.025]),
      low: false,
      tip: '穴を 2つとも ふさごう'
    };
  },
  side: (rng) => {
    const right = rng.chance(0.5);
    const wall = rng.range(0.1, 0.18);
    const open = wall + rng.range(0.42, 0.5);
    const top = rng.range(0.93, 1.0);
    const flip = (x: number) => (right ? x : 1 - x);
    const seg = (x1: number, y1: number, x2: number, y2: number): Seg => [flip(x1), y1, flip(x2), y2];
    const zx = [flip(0), flip(open + 0.14)].sort((p, q) => p - q);
    return {
      pets: [{ x: flip((wall + open) / 2 - 0.02), y: DOG_Y }],
      walls: [seg(wall, top, wall, GROUND), seg(wall, top, open, top)],
      noDraw: [{ x0: zx[0], y0: 0.45, x1: zx[1], y1: top - 0.02 }],
      // 線は重さで倒れるので、外へ足を出して立たせる
      solution: line(
        [flip(open + 0.04), top + 0.01],
        [flip(open + 0.04), GROUND - 0.015],
        [flip(open + 0.2), GROUND - 0.015]
      ),
      low: true,
      side: right ? 'right' : 'left',
      tip: '雲には 線が ひけない！ 入り口を ふさごう'
    };
  },
  platform: (rng) => {
    const w = rng.range(0.4, 0.46);
    const x = rng.range(0.3, 0.7);
    const y = rng.range(0.72, 1.05);
    return {
      pets: [{ x, y: y - 0.075 }],
      walls: [[x - w / 2, y, x + w / 2, y]],
      noDraw: [],
      solution: dome(x, y - 0.005, 0.18),
      low: true,
      tip: '下からも くるかも！ 足場ごと まもろう'
    };
  },
  platform2: (rng) => {
    const [a, b] = [rng.range(0.23, 0.27), rng.range(0.73, 0.77)];
    const [ya, yb] = [rng.range(0.7, 1.05), rng.range(0.7, 1.05)];
    return {
      pets: [
        { x: a, y: ya - 0.075 },
        { x: b, y: yb - 0.075 }
      ],
      walls: [
        [a - 0.19, ya, a + 0.19, ya],
        [b - 0.19, yb, b + 0.19, yb]
      ],
      noDraw: [],
      solution: [
        ...dome(a, ya - 0.005, 0.17),
        { x: a + 0.2, y: ya - 0.03 },
        { x: b - 0.2, y: yb - 0.03 },
        ...dome(b, yb - 0.005, 0.17)
      ],
      low: true,
      tip: '足場の 2ひきを まもろう'
    };
  },
  mixed: (rng) => {
    const left = rng.chance(0.5);
    const [pa, ga] = left ? [0.25, 0.75] : [0.75, 0.25];
    const y = rng.range(0.75, 1.0);
    const pets = [
      { x: pa, y: y - 0.075 },
      { x: ga, y: DOG_Y }
    ];
    const domes = [dome(pa, y - 0.005, 0.17), dome(ga, FLOOR, 0.17)];
    return {
      pets,
      walls: [[pa - 0.19, y, pa + 0.19, y]],
      noDraw: [],
      solution: left
        ? [...domes[0], { x: pa + 0.2, y: y - 0.03 }, ...domes[1]]
        : [...domes[1], { x: pa - 0.2, y: y - 0.03 }, ...domes[0]],
      low: true,
      tip: '足場と 地面の 2ひきを まもろう'
    };
  }
};

/** 新しい型が出てくるレベル。そのレベルでは必ずその型を出して、仕掛けを覚えてもらう */
const UNLOCK: [Kind, number][] = [
  ['open', 1],
  ['cave', 3],
  ['platform', 5],
  ['open2', 8],
  ['side', 11],
  ['mixed', 14],
  ['platform2', 18],
  ['cave2', 22]
];

/** 早く出た型ばかりくり返さないよう、それまでに出た回数がいちばん少ない型から選ぶ */
function kindFor(level: number, rng: Rng, past: Kind[]): Kind {
  const fresh = UNLOCK.find(([, at]) => at === level);
  if (fresh) return fresh[0];
  const prev = past.at(-1);
  const open = UNLOCK.filter(([, at]) => at <= level).map(([k]) => k);
  const candidates = open.length > 1 ? open.filter((k) => k !== prev) : open;
  const used = (k: Kind) => past.filter((p) => p === k).length;
  const least = Math.min(...candidates.map(used));
  return rng.pick(candidates.filter((k) => used(k) === least));
}

const length = (pts: Point[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

function hives(rng: Rng, n: number, layout: Layout): Point[] {
  const out: Point[] = [];
  while (out.length < n) {
    // 地面に近い巣は、足場の面だけ。洞窟や横穴の中には置かない
    const bottom = layout.low && layout.side === undefined && out.length > 0 && rng.chance(0.5);
    let x = rng.range(0.1, 0.9);
    if (layout.side) x = layout.side === 'right' ? rng.range(0.82, 0.92) : rng.range(0.08, 0.18);
    const y = bottom
      ? rng.range(1.12, 1.24)
      : layout.side && out.length > 0
        ? rng.range(0.25, 1.15)
        : rng.range(0.12, 0.32);
    if (layout.pets.some((d) => Math.hypot(d.x - x, d.y - y) < 0.3)) continue;
    if (out.some((h) => Math.hypot(h.x - x, h.y - y) < 0.2)) continue;
    out.push({ x, y });
  }
  return out;
}

/** レベルから面を組み立てる。どの面もクリアできることはテストで確かめている */
export function levelFor(n: number): Stage {
  const level = Math.min(meta.levels, Math.max(1, n));
  const d = difficulty(level, meta.levels);
  const kinds: Kind[] = [];
  for (let l = 1; l <= level; l++) kinds.push(kindFor(l, new Rng(l * 101), kinds));
  const kind = kinds[level - 1];
  const rng = new Rng(level * 1000);
  const layout = LAYOUTS[kind](rng);
  return {
    kind,
    pets: layout.pets.map((p, i): Pet => ({ ...p, kind: (level + i) % 2 === 0 ? 'cat' : 'dog' })),
    walls: [...layout.walls, [0, GROUND, 1, GROUND]],
    noDraw: layout.noDraw,
    hives: hives(rng, d < 0.2 ? 1 : d < 0.55 ? 2 : 3, layout),
    solution: layout.solution,
    ink: length(layout.solution) * lerp(1.6, 1.12, d) + 0.02,
    bees: Math.round(lerp(6, 34, d)),
    speed: lerp(0.42, 0.72, d),
    duration: Math.round(lerp(8, 15, d)),
    spawn: lerp(2, 6, d),
    fast: d < 0.19 ? 0 : lerp(0, 0.45, d),
    big: d < 0.29 ? 0 : lerp(0, 0.35, d),
    tip: layout.tip
  };
}
