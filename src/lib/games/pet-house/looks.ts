import type { Shape, V3 } from './sculpt';
import type { BreedId, Kind } from './types';

/**
 * 種類ごとの骨組み・体の形・毛の色。three を使わない数字と関数だけで、models.ts が組み立てる。
 * 座標は肩の高さを 1 とした単位で、原点は 4 本の足の真ん中の床、+z が前、+x がペットの左。
 * 実物の比率（犬は体長が肩の高さの 1.15 倍、猫は 1.5 倍ほど）に合わせ、models.ts が S 倍する
 */

export type RGB = [number, number, number];

export interface Part extends Shape {
  /** 毛の流れる向き。なければ円すいは a → b、楕円体は後ろ下へ */
  comb?: V3;
}

export interface Look {
  kind: Kind;
  /** 肩の高さ（m） */
  S: number;
  /** 骨の位置と親。足は fl（前左）fr bl br の 0 上腕/もも・1 前腕/すね・2 手首/かかと・3 足先 */
  joints: Record<string, V3>;
  parents: Record<string, string | null>;
  tail: number;
  shapes: Part[];
  /** 格子の間隔 */
  h: number;
  /** 表面の細かいでこぼこ（プードルの巻き毛） */
  detail?: { fn: (x: number, y: number, z: number) => number; amp: number };
  /** 左目の中心の目安と見る向き。右目は x を反転する */
  eye: { at: V3; gaze: V3; r: number; iris: string; pupil: 'dog' | 'cat'; rim: string; lid: string };
  nose: { at: V3; dir: V3; r: V3; color: string; cat: boolean };
  /** 犬の上くちびるの下の端の高さ。ここを黒く縁どる */
  lip?: number;
  /** 猫の ω の口の線。顔の前から面へ写す点の列（左の弧、右の弧） */
  omega?: V3[][];
  /** 下あご（jaw の骨に付く小さな形） */
  chin: Part[];
  /** 口の中の暗い所と舌 */
  inner: { at: V3; r: V3 };
  tongue: { at: V3; r: V3 };
  /** おもちゃを咥える位置（head の骨の上） */
  mouth: V3;
  ears: 'prick' | 'drop';
  whiskers?: { at: V3; len: number };
  fur: { len: number; layers: number; cell: number };
  /** p の場所の毛の長さ（fur.len に掛ける 0..2） */
  furLen: (p: V3, n: V3, tag: string) => number;
  paint: (p: V3, n: V3, tag: string) => string;
  /** 首輪を巻く所（首の中心）と、首の付け根から頭への向き */
  collar: { at: V3; axis: V3 };
  /** 肉球。左前足と左後ろ足の足先の中心と半径（右は x を反転）。前足を上げたときに見える */
  pads: { front: { at: V3; r: V3 }; hind: { at: V3; r: V3 }; color: string };
}

// ---- 小さな道具 ----

const mirror = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];
const cone = (
  a: V3,
  b: V3,
  ra: number,
  rb: number,
  bone: string,
  tag: string,
  k = 0.05,
  x: Partial<Part> = {}
): Part => ({
  a,
  cone: { b, ra, rb },
  k,
  bone,
  tag,
  ...x
});
const ell = (a: V3, r: V3, bone: string, tag: string, k = 0.05, x: Partial<Part> = {}): Part => ({
  a,
  ell: r,
  k,
  bone,
  tag,
  ...x
});
/** 左右に 1 つずつ。bone の l/r は「.l」「.r」ではなく足の名前（fl/fr）で呼び分ける */
function both(make: (s: number, side: 'l' | 'r') => Part[]) {
  return [...make(1, 'l'), ...make(-1, 'r')];
}
const dist = (p: V3, q: V3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 模様の境目をゆらす、なめらかな 3D の値ノイズ（-1..1） */
function noise(x: number, y: number, z: number) {
  const h = (i: number, j: number, k: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const [i, j, k] = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const [u, v, w] = [x - i, y - j, z - k].map((t) => t * t * (3 - 2 * t));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(mix(h(i, j, k), h(i + 1, j, k), u), mix(h(i, j + 1, k), h(i + 1, j + 1, k), u), v),
    mix(mix(h(i, j, k + 1), h(i + 1, j, k + 1), u), mix(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v),
    w
  );
}
const wobble = (p: V3, f: number) =>
  noise(p[0] * f + 7.3, p[1] * f, p[2] * f) + 0.5 * noise(p[0] * f * 2.1, p[1] * f * 2.1 + 3.1, p[2] * f * 2.1);

/** 2 色を t（0..1）で混ぜた色 */
function mixHex(a: string, b: string, t: number) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

// ---- 骨組み ----

type Frame = Record<string, V3>;
const LEGS = ['fl', 'fr', 'bl', 'br'] as const;

function parentsOf(joints: Frame, tail: number) {
  const p: Record<string, string | null> = {
    hips: null,
    chest: 'hips',
    neck: 'chest',
    head: 'neck',
    jaw: 'head',
    'ear.l': 'head',
    'ear.r': 'head'
  };
  for (let i = 0; i < tail; i++) p[`tail.${i}`] = i ? `tail.${i - 1}` : 'hips';
  for (const leg of LEGS)
    for (let i = 0; i < 4; i++) p[`${leg}.${i}`] = i ? `${leg}.${i - 1}` : leg[0] === 'f' ? 'chest' : 'hips';
  for (const k of Object.keys(joints)) if (!(k in p)) throw new Error(k);
  return p;
}

/** 脚の関節を左右に置く。front / hind は左（+x）の 4 点 */
function legs(front: V3[], hind: V3[]): Frame {
  const f: Frame = {};
  for (const [leg, pts] of [
    ['f', front],
    ['b', hind]
  ] as const)
    pts.forEach((p, i) => {
      f[`${leg}l.${i}`] = p;
      f[`${leg}r.${i}`] = mirror(p, -1);
    });
  return f;
}

/** 脚の形。関節の点をつなぐ円すいと足先の楕円体 */
function legShapes(
  j: Frame,
  front: number[],
  hind: number[],
  paw: V3,
  fpaw: V3,
  hpaw: V3,
  extra: (s: number, leg: string) => Part[]
) {
  return both((s, side) => {
    const f = `f${side}`;
    const b = `b${side}`;
    const J = (n: string) => j[n];
    const down: V3 = [0, -1, 0.15];
    return [
      cone(J(`${f}.0`), J(`${f}.1`), front[0], front[1], `${f}.0`, 'arm', 0.06, { comb: [0, -1, -0.3] }),
      cone(J(`${f}.1`), J(`${f}.2`), front[2], front[3], `${f}.1`, 'fore', 0.04, { comb: down }),
      ell(lerp3(J(`${f}.1`), J(`${f}.0`), 0.1), [front[2] * 0.95, front[2], front[2]], `${f}.1`, 'elbow', 0.04),
      cone(J(`${f}.2`), J(`${f}.3`), front[4], front[4] * 1.02, `${f}.2`, 'past', 0.03, { comb: down }),
      ell(mirror(fpaw, s), paw, `${f}.3`, 'paw', 0.035, { comb: [0, 0, 1] }),
      cone(J(`${b}.0`), J(`${b}.1`), hind[0], hind[1], `${b}.0`, 'thigh', 0.07, { comb: [0, -1, -0.4] }),
      cone(J(`${b}.1`), J(`${b}.2`), hind[2], hind[3], `${b}.1`, 'shin', 0.04, { comb: [0, -1, -0.5] }),
      cone(J(`${b}.2`), J(`${b}.3`), hind[4], hind[4] * 1.02, `${b}.2`, 'meta', 0.03, { comb: down }),
      ell(mirror(hpaw, s), paw, `${b}.3`, 'paw', 0.035, { comb: [0, 0, 1] }),
      ...extra(s, side)
    ];
  });
}

/** しっぽを点の列に沿った円すいでつなぐ */
function tailShapes(pts: V3[], radii: number[], k = 0.03): Part[] {
  return pts.slice(0, -1).map((p, i) => cone(p, pts[i + 1], radii[i], radii[i + 1], `tail.${i}`, 'tail', k));
}
function tailJoints(pts: V3[]) {
  const f: Frame = {};
  pts.slice(0, -1).forEach((p, i) => (f[`tail.${i}`] = p));
  return f;
}

/** 首輪は首の円すいの付け根から 55% の所（あごのすぐ下）に巻く */
function collarOn(shapes: Part[]): Look['collar'] {
  const neck = shapes.find((s) => s.tag === 'neck')!;
  const b = neck.cone!.b;
  return { at: lerp3(neck.a, b, 0.55), axis: [b[0] - neck.a[0], b[1] - neck.a[1], b[2] - neck.a[2]] };
}

/**
 * 子犬・子猫の短い胴にするため、頭より後ろ（胴・足・しっぽ）を前後に縮める。
 * 頭は atlas ごと動かすので、首の円すいは付け根（a）だけを縮める
 */
const TORSO = new Set(['rib', 'brisket', 'loin', 'rump', 'pouch']);
function compress(joints: Frame, shapes: Part[], k: number) {
  const head = new Set(['head', 'jaw', 'ear.l', 'ear.r']);
  const z = (p: V3): V3 => [p[0], p[1], p[2] * k];
  for (const n of Object.keys(joints)) if (!head.has(n)) joints[n] = z(joints[n]);
  return shapes.map((sh) => {
    if (head.has(sh.bone)) return sh;
    const out: Part = { ...sh, a: z(sh.a) };
    if (sh.cone && sh.bone !== 'neck') out.cone = { ...sh.cone, b: z(sh.cone.b) };
    if (sh.ell && TORSO.has(sh.tag)) out.ell = [sh.ell[0], sh.ell[1], sh.ell[2] * k];
    return out;
  });
}

// ---- 犬 ----

/** 頭の形の名前。模様は頭の大きさ・位置を変える前の座標で塗る */
const HEAD = new Set(['skull', 'brow', 'cheek', 'muzzle', 'lip', 'chin', 'pad', 'ear', 'earIn', 'socket']);

/**
 * 頭の形を作る座標（design の atlas のまわりで設計した点）を、大きさ hd 倍して at へ動かす写像と、その逆。
 * 逆は模様と毛の長さを、頭の大きさや位置によらず同じ座標で決めるのに使う
 */
function headMap(design: V3, at: V3, hd: number) {
  const H = (p: V3): V3 => [p[0] * hd, at[1] + (p[1] - design[1]) * hd, at[2] + (p[2] - design[2]) * hd];
  const inv = (p: V3): V3 => [p[0] / hd, design[1] + (p[1] - at[1]) / hd, design[2] + (p[2] - at[2]) / hd];
  const wrap =
    <T>(fn: (p: V3, n: V3, tag: string) => T) =>
    (p: V3, n: V3, tag: string) =>
      fn(HEAD.has(tag) ? inv(p) : p, n, tag);
  return { H, wrap };
}

interface DogBuild {
  S: number;
  /** 胴の太さ・胸の深さ・足の太さ・頭の大きさ・鼻先の長さと幅 */
  girth: number;
  deep: number;
  bone: number;
  head: number;
  muzzle: number;
  muzzleW: number;
  /** 頭の位置を標準からずらす量（y, z） */
  headAt?: [number, number];
  /** 目の大きさの倍率 */
  eyeR?: number;
  /** 胴の長さ・足先の大きさ・耳の大きさの倍率（子犬は胴が短く、足先と耳が大きい） */
  short?: number;
  paw?: number;
  ear?: number;
  pads?: string;
  ears: 'prick' | 'drop';
  tail: { pts: V3[]; r: number[] };
  fur: Look['fur'];
  furLen: Look['furLen'];
  paint: Look['paint'];
  eye: { iris: string; rim: string; lid: string };
  nose: string;
  extra?: (H: (p: V3) => V3) => Part[];
  /** 表面のでこぼこ。頭の大きさ・位置に合わせて顔をよけられるよう、頭の写像を受け取る */
  detail?: (H: (p: V3) => V3) => Look['detail'];
  h?: number;
}

function dog(b: DogBuild): Look {
  const g = b.girth;
  const hd = b.head;
  const mw = b.muzzleW;
  const dy = (1 - b.deep) * 0.12;
  const design: V3 = [0, 1.12, 0.58];
  const [oy, oz] = b.headAt ?? [-0.06, -0.03];
  const k = b.short ?? 1;
  const pw = b.paw ?? 1;
  const atlas: V3 = [0, design[1] + oy, design[2] * k + oz];
  const { H, wrap } = headMap(design, atlas, hd);
  // 鼻先は目の前（z 0.8）から先だけを長さ muzzle 倍・幅 muzzleW 倍にする
  const M = (p: V3): V3 => {
    const q = H(p);
    const z0 = H([0, 0, 0.8])[2];
    // 子犬は鼻が目のすぐ下にある。鼻先ごと少し持ち上げる
    return [q[0] * mw, q[1] + 0.015 * hd, z0 + (q[2] - z0) * b.muzzle];
  };
  // 口は鼻のすぐ下に寄せる（鼻から口が遠いと面長の大人の顔になる）
  const Mo = (p: V3): V3 => M([p[0], p[1] + 0.036, p[2]]);
  const joints: Frame = {
    hips: [0, 0.8, -0.42],
    chest: [0, 0.8, -0.05],
    neck: [0, 0.84, 0.36],
    head: atlas,
    jaw: Mo([0, 1.075, 0.76]),
    'ear.l': H([0.1, 1.28, 0.62]),
    'ear.r': H([-0.1, 1.28, 0.62]),
    ...tailJoints(b.tail.pts),
    ...legs(
      [
        [0.14, 0.68, 0.44],
        [0.14, 0.46 + dy, 0.33],
        [0.13, 0.12, 0.38],
        [0.13, 0.055, 0.41]
      ],
      [
        [0.13, 0.76, -0.44],
        [0.15, 0.48, -0.3],
        [0.13, 0.23, -0.53],
        [0.12, 0.055, -0.47]
      ]
    )
  };
  // 足先は球に近いもこもこ（平たい楕円だと白い筒の先に見える）
  const pawR: V3 = [0.062 * b.bone * pw, 0.058 * pw, 0.07 * b.bone * pw];
  const shapes: Part[] = [
    ell([0, 0.69 + dy * 0.5, 0.16], [0.2 * g, 0.25 * b.deep + 0.02, 0.33], 'chest', 'rib', 0.09),
    ell([0, 0.62 + dy, 0.4], [0.15 * g, 0.19 * b.deep, 0.13], 'chest', 'brisket', 0.08),
    ...both((s) => [
      cone([0.08 * s, 0.92, 0.22], [0.14 * s * g, 0.68, 0.42], 0.09, 0.085, 'chest', 'scap', 0.07, {
        comb: [0, -1, -0.5]
      })
    ]),
    cone([0, 0.73 + dy * 0.5, 0.04], [0, 0.79, -0.22], 0.2 * g, 0.16 * g, 'chest', 'loin', 0.08, {
      comb: [0, -0.2, -1]
    }),
    cone([0, 0.79, -0.22], [0, 0.8, -0.43], 0.16 * g, 0.17 * g, 'hips', 'loin', 0.08, { comb: [0, -0.2, -1] }),
    ell([0, 0.8, -0.48], [0.16 * g, 0.17, 0.16], 'hips', 'rump', 0.07),
    cone([0, 0.8, 0.3], H([0, 1.1, 0.57]), 0.18 * g, 0.14 * hd, 'neck', 'neck', 0.1, { comb: [0, -0.6, -1] }),
    ell(H([0, 1.21, 0.66]), [0.17 * hd, 0.145 * hd, 0.165 * hd], 'head', 'skull', 0.06, { comb: [0, 0.3, -1] }),
    ...both((s) => [
      ell(mirror(H([0.055, 1.255, 0.785]), s), [0.04 * hd, 0.024 * hd, 0.03 * hd], 'head', 'brow', 0.035, {
        comb: [0, 0.5, -1]
      }),
      // ほほは横へ張り出させない（顔が横に広がって頬袋のように見える）。ふっくら感は口もとの下で出す
      ell(mirror(H([0.085, 1.115, 0.73]), s), [0.075 * hd, 0.075 * hd, 0.085 * hd], 'head', 'cheek', 0.06, {
        comb: [s * 0.6, -0.5, -0.6]
      }),
      ell(mirror(Mo([0.034, 1.088, 0.87]), s), [0.036 * hd * mw, 0.028 * hd, 0.068 * hd], 'head', 'lip', 0.03, {
        comb: [0, -0.3, -1]
      })
    ]),
    // 鼻先は上下に平たくし、下の端をあごの線にそろえる
    cone(M([0, 1.13, 0.8]), M([0, 1.12, 0.945]), 0.074 * hd * mw, 0.046 * hd * mw, 'head', 'muzzle', 0.07, {
      comb: [0, 0.2, -1],
      squash: [1, 0.55, 1]
    }),
    ...legShapes(
      joints,
      [0.1 * b.bone, 0.072 * b.bone, 0.062 * b.bone, 0.045 * b.bone, 0.043 * b.bone],
      [0.14 * b.bone, 0.078 * b.bone, 0.068 * b.bone, 0.044 * b.bone, 0.041 * b.bone],
      pawR,
      [0.13, pawR[1], 0.46],
      [0.12, pawR[1], -0.42],
      (s, side) => [
        ell([0.13 * s, 0.64, -0.48], [0.1 * b.bone, 0.14, 0.11], `b${side}.0`, 'ham', 0.07, { comb: [0, -1, -0.3] }),
        ell([0.14 * s, 0.38, -0.41], [0.06 * b.bone, 0.1, 0.06], `b${side}.1`, 'calf', 0.04, { comb: [0, -1, -0.3] })
      ]
    ),
    ...tailShapes(b.tail.pts, b.tail.r),
    ...earShapes(b.ears, H, hd, b.ear ?? 1),
    ...(b.extra?.(H) ?? [])
  ];
  const body = compress(joints, shapes, k);
  const detail = b.detail?.(H);
  return {
    kind: 'dog',
    S: b.S,
    joints,
    parents: parentsOf(joints, b.tail.pts.length - 1),
    tail: b.tail.pts.length - 1,
    shapes: body,
    h: b.h ?? 0.018,
    detail,
    eye: {
      at: H([0.078, 1.225, 0.79]),
      gaze: [0.36, 0.05, 1],
      r: 0.029 * hd * (b.eyeR ?? 1),
      iris: b.eye.iris,
      pupil: 'dog',
      rim: b.eye.rim,
      lid: b.eye.lid
    },
    nose: {
      at: M([0, 1.13, 0.95]),
      dir: [0, 0.25, 1],
      r: [0.029 * hd * mw, 0.021 * hd, 0.018 * hd],
      color: b.nose,
      cat: false
    },
    lip: Mo([0, 1.053, 0.8])[1],
    chin: [cone(Mo([0, 1.06, 0.78]), Mo([0, 1.062, 0.9]), 0.036 * hd * mw, 0.024 * hd * mw, 'jaw', 'chin', 0.04)],
    inner: { at: Mo([0, 1.075, 0.87]), r: [0.05 * hd * mw, 0.025 * hd, 0.085 * hd * b.muzzle] },
    tongue: { at: Mo([0, 1.072, 0.87]), r: [0.028 * hd * mw, 0.01 * hd, 0.058 * hd * b.muzzle] },
    mouth: Mo([0, 1.07, 0.985]),
    ears: b.ears,
    fur: b.fur,
    furLen: wrap(b.furLen),
    paint: wrap(b.paint),
    collar: collarOn(body),
    pads: {
      front: { at: [0.13, pawR[1], 0.46 * k], r: pawR },
      hind: { at: [0.12, pawR[1], -0.42 * k], r: pawR },
      color: b.pads ?? '#4a3a37'
    }
  };
}

function earShapes(kind: 'prick' | 'drop', H: (p: V3) => V3, hd: number, es: number): Part[] {
  // 耳は付け根を中心に es 倍する
  const E = (base: V3, p: V3): V3 => [
    base[0] + (p[0] - base[0]) * es,
    base[1] + (p[1] - base[1]) * es,
    base[2] + (p[2] - base[2]) * es
  ];
  const P = (p: V3) => E([0.1, 1.28, 0.63], p);
  hd *= es;
  if (kind === 'prick')
    return both((s, side) => [
      cone(
        mirror(H(P([0.1, 1.27, 0.62])), s),
        mirror(H(P([0.18, 1.43, 0.63])), s),
        0.08 * hd,
        0.036 * hd,
        `ear.${side}`,
        'ear',
        0.035,
        {
          squash: [1, 1, 0.36],
          turn: [0.12, 0, 0]
        }
      ),
      cone(
        mirror(H(P([0.11, 1.3, 0.652])), s),
        mirror(H(P([0.17, 1.4, 0.655])), s),
        0.04 * hd,
        0.016 * hd,
        `ear.${side}`,
        'earIn',
        0.012,
        {
          squash: [1, 1, 0.22],
          turn: [0.12, 0, 0],
          cut: true
        }
      )
    ]);
  return both((s, side) => [
    cone(
      mirror(H(P([0.13, 1.27, 0.63])), s),
      mirror(H(P([0.16, 1.02, 0.67])), s),
      0.07 * hd,
      0.075 * hd,
      `ear.${side}`,
      'ear',
      0.03,
      {
        squash: [0.34, 1, 1],
        turn: [0, 0, s * 0.1],
        comb: [0, -1, 0]
      }
    )
  ]);
}

// ---- 猫 ----

interface CatBuild {
  S: number;
  girth: number;
  head: number;
  /** 子猫らしさ。胴の長さ・足の太さ・足先・耳・目の大きさの倍率 */
  short?: number;
  bone?: number;
  paw?: number;
  ear?: number;
  eyeR?: number;
  pads?: string;
  fur: Look['fur'];
  furLen: Look['furLen'];
  paint: Look['paint'];
  eye: { iris: string; rim: string; lid: string };
  nose: string;
}

function cat(b: CatBuild): Look {
  const g = b.girth;
  const hd = b.head;
  const design: V3 = [0, 1.04, 0.7];
  const k = b.short ?? 1;
  const bn = b.bone ?? 1;
  const pw = b.paw ?? 1;
  const es = b.ear ?? 1;
  const atlas: V3 = [0, 0.95, 0.63 * k];
  const { H, wrap } = headMap(design, atlas, hd);
  const P = (p: V3): V3 => {
    const base: V3 = [0.1, 1.2, 0.77];
    return [base[0] + (p[0] - base[0]) * es, base[1] + (p[1] - base[1]) * es, base[2] + (p[2] - base[2]) * es];
  };
  const tail: V3[] = [
    [0, 0.93, -0.68],
    [0, 0.86, -0.84],
    [0, 0.74, -0.97],
    [0, 0.63, -1.1],
    [0, 0.56, -1.25],
    [0, 0.54, -1.41],
    [0, 0.58, -1.56],
    [0, 0.66, -1.68]
  ];
  const joints: Frame = {
    hips: [0, 0.88, -0.5],
    chest: [0, 0.84, -0.06],
    neck: [0, 0.84, 0.44],
    head: atlas,
    jaw: H([0, 1.0, 0.87]),
    'ear.l': H([0.1, 1.2, 0.77]),
    'ear.r': H([-0.1, 1.2, 0.77]),
    ...tailJoints(tail),
    ...legs(
      [
        [0.12, 0.7, 0.55],
        [0.12, 0.47, 0.44],
        [0.11, 0.1, 0.51],
        [0.11, 0.048, 0.54]
      ],
      [
        [0.12, 0.84, -0.54],
        [0.135, 0.53, -0.4],
        [0.11, 0.26, -0.63],
        [0.1, 0.048, -0.57]
      ]
    )
  };
  const pawR: V3 = [0.058 * pw, 0.052 * pw, 0.064 * pw];
  const shapes: Part[] = [
    ell([0, 0.68, 0.22], [0.18 * g, 0.25, 0.35], 'chest', 'rib', 0.1),
    ell([0, 0.64, 0.48], [0.13 * g, 0.16, 0.1], 'chest', 'brisket', 0.07),
    ...both((s) => [
      cone([0.07 * s, 0.9, 0.34], [0.12 * s * g, 0.7, 0.53], 0.08, 0.075, 'chest', 'scap', 0.06, {
        comb: [0, -1, -0.5]
      })
    ]),
    cone([0, 0.72, 0.04], [0, 0.78, -0.3], 0.19 * g, 0.175 * g, 'chest', 'loin', 0.09, { comb: [0, -0.2, -1] }),
    cone([0, 0.78, -0.3], [0, 0.85, -0.52], 0.175 * g, 0.165 * g, 'hips', 'loin', 0.09, { comb: [0, -0.2, -1] }),
    ell([0, 0.6, -0.28], [0.13 * g, 0.09, 0.18], 'hips', 'pouch', 0.09),
    ell([0, 0.86, -0.57], [0.155 * g, 0.155, 0.14], 'hips', 'rump', 0.07),
    cone([0, 0.78, 0.38], H([0, 1.0, 0.7]), 0.17 * g, 0.14 * hd, 'neck', 'neck', 0.1, { comb: [0, -0.6, -1] }),
    ell(H([0, 1.105, 0.8]), [0.19 * hd, 0.16 * hd, 0.16 * hd], 'head', 'skull', 0.06, { comb: [0, 0.3, -1] }),
    ...both((s) => [
      ell(mirror(H([0.085, 1.02, 0.86]), s), [0.085 * hd, 0.08 * hd, 0.08 * hd], 'head', 'cheek', 0.06, {
        comb: [s, -0.3, -0.5]
      }),
      ell(mirror(H([0.032, 1.022, 0.946]), s), [0.042 * hd, 0.034 * hd, 0.036 * hd], 'head', 'pad', 0.035, {
        comb: [s, -0.2, 0.2]
      })
    ]),
    ell(H([0, 1.04, 0.92]), [0.07 * hd, 0.05 * hd, 0.06 * hd], 'head', 'muzzle', 0.05, { comb: [0, 0.3, -1] }),
    ...legShapes(
      joints,
      [0.082 * bn, 0.066 * bn, 0.056 * bn, 0.04 * bn, 0.038 * bn],
      [0.13 * bn, 0.075 * bn, 0.064 * bn, 0.04 * bn, 0.037 * bn],
      pawR,
      [0.11, pawR[1], 0.575],
      [0.1, pawR[1], -0.535],
      (s, side) => [
        ell([0.12 * s, 0.68, -0.57], [0.095, 0.15, 0.12], `b${side}.0`, 'ham', 0.08, { comb: [0, -1, -0.3] }),
        // ひざと腹をつなぐ皮。猫はひざが腹の線まで上がっていて、ももが胴に埋もれて見える
        ell([0.12 * s, 0.6, -0.4], [0.085, 0.09, 0.13], `b${side}.0`, 'flank', 0.09, { comb: [0, -1, -0.3] }),
        ell([0.125 * s, 0.4, -0.48], [0.05, 0.1, 0.055], `b${side}.1`, 'calf', 0.04, { comb: [0, -1, -0.3] })
      ]
    ),
    ...tailShapes(tail, [0.075, 0.068, 0.062, 0.058, 0.055, 0.053, 0.052, 0.046]),
    ...both((s, side) => [
      cone(
        mirror(H(P([0.095, 1.2, 0.77])), s),
        mirror(H(P([0.16, 1.4, 0.752])), s),
        0.09 * hd * es,
        0.01 * hd * es,
        `ear.${side}`,
        'ear',
        0.03,
        {
          squash: [1, 1, 0.3],
          turn: [0.1, 0, 0]
        }
      ),
      cone(
        mirror(H(P([0.097, 1.22, 0.79])), s),
        mirror(H(P([0.155, 1.38, 0.772])), s),
        0.066 * hd * es,
        0.006 * hd * es,
        `ear.${side}`,
        'earIn',
        0.01,
        {
          squash: [1, 1, 0.2],
          turn: [0.1, 0, 0],
          cut: true
        }
      )
    ])
  ];
  const body = compress(joints, shapes, k);
  return {
    kind: 'cat',
    S: b.S,
    joints,
    parents: parentsOf(joints, tail.length - 1),
    tail: tail.length - 1,
    shapes: body,
    h: 0.019,
    eye: {
      at: H([0.084, 1.112, 0.9]),
      gaze: [0.26, 0.02, 1],
      r: 0.047 * hd * (b.eyeR ?? 1),
      iris: b.eye.iris,
      pupil: 'cat',
      rim: b.eye.rim,
      lid: b.eye.lid
    },
    nose: {
      at: H([0, 1.055, 0.99]),
      dir: [0, 0.35, 1],
      r: [0.031 * hd, 0.019 * hd, 0.018 * hd],
      color: b.nose,
      cat: true
    },
    omega: [1, -1].map((s) =>
      (
        [
          [0, 1.04],
          [0, 1.02],
          [0.008, 1.007],
          [0.017, 1.002],
          [0.026, 1.003],
          [0.033, 1.007]
        ] as const
      ).map(([x, y]) => H([x * s, y, 0.9]))
    ),
    chin: [cone(H([0, 0.995, 0.88]), H([0, 1.0, 0.94]), 0.032 * hd, 0.022 * hd, 'jaw', 'chin', 0.03)],
    inner: { at: H([0, 1.01, 0.925]), r: [0.04 * hd, 0.018 * hd, 0.045 * hd] },
    tongue: { at: H([0, 1.008, 0.935]), r: [0.026 * hd, 0.008 * hd, 0.036 * hd] },
    mouth: H([0, 1.005, 0.99]),
    ears: 'prick',
    whiskers: { at: H([0.05, 1.02, 0.99]), len: 0.22 },
    fur: b.fur,
    furLen: wrap(b.furLen),
    paint: wrap(b.paint),
    collar: collarOn(body),
    pads: {
      front: { at: [0.11, pawR[1], 0.575 * k], r: pawR },
      hind: { at: [0.1, pawR[1], -0.535 * k], r: pawR },
      color: b.pads ?? '#e89aa6'
    }
  };
}

// ---- 毛の長さの共通のくせ ----

/**
 * 顔（頭・鼻先・耳の外側）は殻を重ねず、なめらかな面に毛並みのむらを描く（fur.ts）。
 * 殻の毛は顔では 1 本ずつの粒に見え、輪郭がとげとげし模様の境目もぼける。胸と首まわりとしっぽは長い
 */
function furBase(p: V3, n: V3, tag: string) {
  switch (tag) {
    case 'muzzle':
    case 'pad':
    case 'chin':
    case 'lip':
    case 'brow':
    case 'skull':
    case 'ear':
      return 0;
    // 耳の中はふわふわ
    case 'earIn':
      return 0.9;
    case 'paw':
      // 足の裏は肉球を見せるので毛を生やさない
      return n[1] < -0.35 ? 0.03 : 0.5;
    case 'past':
    case 'meta':
      return 0.55;
    case 'fore':
    case 'shin':
      return 0.7;
    // 首まわり・胸・ほほ・しっぽ・お尻はとくに長くして、子犬・子猫のようにふわっとさせる
    // ほほは形でふくらませ、輪郭がやわらかく見える程度の短い毛だけ
    case 'cheek':
      return 0.3;
    case 'neck':
    case 'brisket':
      return 1.6;
    case 'tail':
      return 1.9;
    case 'rump':
    case 'ham':
    case 'thigh':
      return 1.2;
    default:
      return 1;
  }
}

// ---- 種類ごと ----

const SHIBA_RED = '#c8662c';
const SHIBA_WHITE = '#f6ecdc';
const SHIBA_CREAM = '#efc896';

const shibaTail: V3[] = [
  [0, 0.9, -0.6],
  [0, 1.03, -0.68],
  [0, 1.16, -0.65],
  [0.02, 1.23, -0.55],
  [0.045, 1.21, -0.43],
  [0.06, 1.12, -0.39]
];

/** 柴犬の裏白（ほほ・口もと・のど・胸・腹・足の内側としっぽの裏） */
function shibaPaint(p: V3, n: V3, tag: string) {
  const w = 0.05 * wobble(p, 9);
  let white = 0;
  switch (tag) {
    // 裏白: 口もと・あご・ほほは白く、鼻筋の上だけうすく色を残す
    case 'muzzle':
    case 'lip':
    case 'chin':
      // 鼻筋は赤く残し、口もとと鼻の下を白くする（柴の顔の見分けどころ）
      white = 1 - 0.85 * smooth(0.3, 0.7, n[1]) * smooth(0.05, 0.025, Math.abs(p[0]) + w * 0.3);
      break;
    case 'cheek':
      white = smooth(1.18, 1.13, p[1] + w);
      break;
    case 'skull':
    case 'brow':
      // 目の下から横へ白を回し、目の下のふちを白く見せる
      white = Math.max(
        smooth(1.17, 1.12, p[1] + w),
        smooth(1.205, 1.185, p[1] + w * 0.3) * smooth(0.72, 0.77, p[2]) * smooth(0.03, 0.06, Math.abs(p[0]))
      );
      break;
    case 'neck':
      white = smooth(-0.1, 0.35, dot(n, [0, -0.55, 0.83]) + w * 2);
      break;
    case 'brisket':
      white = smooth(-0.2, 0.3, n[2] - n[1] * 0.3 + w * 2);
      break;
    case 'rib':
    case 'loin':
      white = smooth(0.62, 0.52, p[1] + w);
      break;
    case 'arm':
    case 'fore':
    case 'elbow':
      white = Math.max(
        smooth(0.3, 0.2, p[1] + w),
        smooth(0.0, -0.45, n[0] * Math.sign(p[0]) - w * 2),
        smooth(0.2, 0.7, n[2]) * smooth(0.45, 0.3, p[1])
      );
      break;
    case 'past':
    case 'paw':
      white = 1;
      break;
    case 'thigh':
    case 'ham':
    case 'calf':
    case 'shin':
    case 'meta':
      white = Math.max(
        smooth(0.22, 0.12, p[1] + w),
        smooth(-0.05, -0.5, n[0] * Math.sign(p[0]) - w * 2),
        smooth(-0.3, -0.8, n[2]) * smooth(0.7, 0.55, p[1])
      );
      break;
    case 'tail': {
      const c: V3 = [0.03, 1.07, -0.55];
      white = smooth(0.0, 0.5, dot(n, [c[0] - p[0], c[1] - p[1], c[2] - p[2]]) / Math.max(0.01, dist(p, c)) + w * 2);
      break;
    }
    case 'earIn':
      return SHIBA_CREAM;
  }
  let c = mixHex(SHIBA_RED, SHIBA_WHITE, white);
  // 麻呂眉（目の上の丸い点）。大きいと目の上にかぶさって怒った眉に見える
  for (const s of [1, -1]) {
    const d = dist(p, [0.055 * s, 1.295, 0.785]);
    if (d < 0.03) c = mixHex(c, SHIBA_CREAM, smooth(0.028, 0.018, d));
  }
  return c;
}

const BEAGLE_TAN = '#b8732f';
const BEAGLE_BLACK = '#2a2420';
const BEAGLE_WHITE = '#f7f1e6';

function beaglePaint(p: V3, n: V3, tag: string) {
  const w = 0.06 * wobble(p, 7);
  const saddle = smooth(0.73, 0.8, p[1] + w) * smooth(0.28, 0.12, p[2] + w) * smooth(-0.62, -0.45, p[2] - w);
  let white = 0;
  switch (tag) {
    case 'muzzle':
    case 'chin':
      white = 1;
      break;
    case 'skull':
    case 'brow':
      // 額の白い筋と、あごの下
      white = Math.max(
        smooth(0.045, 0.025, Math.abs(p[0]) - 0.1 * (1.26 - p[1]) + w * 0.2) * smooth(0.6, 0.72, p[2]),
        smooth(1.16, 1.11, p[1])
      );
      break;
    case 'cheek':
      white = smooth(1.18, 1.12, p[1] + w);
      break;
    case 'neck':
      white = smooth(-0.2, 0.3, dot(n, [0, -0.5, 0.86]) + w * 2);
      break;
    case 'brisket':
      white = 1;
      break;
    case 'rib':
    case 'loin':
    case 'rump':
      white = smooth(0.66, 0.56, p[1] + w);
      break;
    case 'tail':
      return mixHex(BEAGLE_BLACK, BEAGLE_WHITE, smooth(1.12, 1.2, p[1] + p[2] * 0.2));
    case 'ear':
      return mixHex(BEAGLE_TAN, '#8e5423', smooth(1.15, 1.02, p[1]));
    default:
      if (['arm', 'fore', 'elbow', 'past', 'paw', 'shin', 'meta', 'calf'].includes(tag)) white = 1;
      else if (tag === 'thigh' || tag === 'ham') white = smooth(0.52, 0.42, p[1] + w);
  }
  const base = mixHex(BEAGLE_TAN, BEAGLE_BLACK, saddle);
  return mixHex(base, BEAGLE_WHITE, white);
}

/** トイプードルの巻き毛。格子に散らした点のまわりを盛り上げる */
function curls(x: number, y: number, z: number) {
  const c = 0.05;
  const [u, v, w] = [x / c, y / c, z / c];
  const [i, j, k] = [Math.floor(u), Math.floor(v), Math.floor(w)];
  // 点はマスの 0.2..0.8 にあるので、近い側の隣だけを見れば足りる
  const [si, sj, sk] = [u - i < 0.5 ? -1 : 1, v - j < 0.5 ? -1 : 1, w - k < 0.5 ? -1 : 1];
  let best = 9;
  for (const a of [0, si])
    for (const b of [0, sj])
      for (const d of [0, sk]) {
        let hsh = Math.imul(i + a, 73856093) ^ Math.imul(j + b, 19349663) ^ Math.imul(k + d, 83492791);
        hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
        const r = ((hsh >>> 8) & 0xffff) / 0xffff;
        const px = i + a + 0.2 + 0.6 * r;
        const py = j + b + 0.2 + 0.6 * ((r * 7.13) % 1);
        const pz = k + d + 0.2 + 0.6 * ((r * 3.71) % 1);
        best = Math.min(best, (u - px) ** 2 + (v - py) ** 2 + (w - pz) ** 2);
      }
  return 1 - Math.min(1, Math.sqrt(best) / 0.85);
}

const POODLE = '#e3b27a';
const POODLE_DARK = '#b98452';

const LOOKS_DATA = {
  shiba: dog({
    S: 0.3,
    girth: 1.14,
    deep: 1.2,
    bone: 1.3,
    head: 1.4,
    muzzle: 0.6,
    muzzleW: 1.02,
    headAt: [-0.12, -0.02],
    eyeR: 1.12,
    ear: 0.8,
    short: 0.84,
    paw: 1.05,
    pads: '#4a3a37',

    ears: 'prick',
    tail: { pts: shibaTail, r: [0.07, 0.085, 0.085, 0.08, 0.07, 0.05] },
    fur: { len: 0.05, layers: 8, cell: 0.0048 },
    furLen: furBase,
    paint: shibaPaint,
    eye: { iris: '#5a3218', rim: '#140e0c', lid: SHIBA_RED },
    nose: '#1e1a1a'
  }),
  beagle: dog({
    S: 0.3,
    girth: 1.14,
    deep: 1.2,
    bone: 1.28,
    head: 1.36,
    muzzle: 0.8,
    muzzleW: 1.18,
    headAt: [-0.12, -0.02],
    eyeR: 1.12,
    ear: 1.05,
    short: 0.84,
    paw: 1.05,

    ears: 'drop',
    tail: {
      pts: [
        [0, 0.9, -0.6],
        [0, 1.02, -0.68],
        [0, 1.16, -0.72],
        [0, 1.3, -0.72],
        [0, 1.42, -0.68]
      ],
      r: [0.05, 0.045, 0.04, 0.035, 0.03]
    },
    fur: { len: 0.024, layers: 5, cell: 0.0058 },
    furLen: (p, n, tag) => Math.min(1, furBase(p, n, tag)),
    paint: beaglePaint,
    eye: { iris: '#5c3418', rim: '#140e0c', lid: BEAGLE_TAN },
    nose: '#221c1b'
  }),
  poodle: dog({
    S: 0.25,
    girth: 1.1,
    deep: 1.1,
    bone: 1.35,
    head: 1.38,
    muzzle: 0.6,
    eyeR: 1.15,
    muzzleW: 1.1,
    headAt: [-0.1, -0.02],
    short: 0.85,
    paw: 1.1,
    ears: 'drop',
    tail: {
      pts: [
        [0, 0.9, -0.6],
        [0, 1.0, -0.64],
        [0, 1.1, -0.64]
      ],
      r: [0.06, 0.07, 0.11]
    },
    h: 0.016,
    fur: { len: 0.038, layers: 6, cell: 0.005 },
    // 巻き毛は頭のてっぺんまで。顔まわりはなめらかにする
    furLen: (p, n, tag) => (tag === 'skull' ? 0.8 : furBase(p, n, tag) === 0 ? 0 : 1),
    detail: (H) => {
      const eye = H([0.078, 1.225, 0.8]);
      const nose = H([0, 1.12, 0.9]);
      const mid = H([0, 1.17, 0.84]);
      const r = eye[1] - H([0, 1.225 - 0.07, 0])[1];
      return {
        amp: 0.015,
        fn: (x, y, z) => {
          // 顔の前（目・鼻先・ほほ）と足の裏（肉球）は巻き毛にしない。巻き毛は頭のてっぺんと体だけ
          const face = Math.min(
            Math.hypot(Math.abs(x) - eye[0], y - eye[1], z - eye[2]),
            Math.hypot(x, y - nose[1], z - nose[2])
          );
          if (face < r || y < 0.07) return 0;
          const front = smooth(r * 2.2, r * 3.4, Math.hypot(x, y - mid[1], z - mid[2]));
          return 0.015 * curls(x, y, z) * smooth(r, r * 1.7, face) * front;
        }
      };
    },
    // 巻き毛のくぼみを暗くしすぎると砂の像に見える
    paint: (p) => mixHex(POODLE_DARK, POODLE, 0.65 + 0.35 * curls(p[0], p[1], p[2])),
    eye: { iris: '#4a2a16', rim: '#140e0c', lid: POODLE },
    nose: '#2a1f1c',
    // ふわっと丸い頭のてっぺんと、ほほの毛
    extra: (H) => [
      ell(H([0, 1.33, 0.62]), [0.15, 0.1, 0.14], 'head', 'skull', 0.07),
      ...both((s) => [ell(mirror(H([0.1, 1.1, 0.74]), s), [0.08, 0.085, 0.08], 'head', 'cheek', 0.05)])
    ]
  }),
  mike: cat({
    S: 0.22,
    girth: 1.08,
    head: 1.52,
    short: 0.84,
    bone: 1.2,
    paw: 1.1,
    ear: 0.98,
    eyeR: 1.06,

    fur: { len: 0.045, layers: 8, cell: 0.005 },
    furLen: furBase,
    paint: (p, n, tag) => {
      if (tag === 'earIn') return '#e9a9a9';
      const w = 0.05 * wobble(p, 6);
      const orange = Math.max(
        // 片方の耳から目のまわりへかかる茶の模様
        smooth(0.13, 0.08, dist(p, [0.1, 1.2, 0.76]) + w),
        smooth(0.07, 0.04, dist(p, [0.1, 1.13, 0.86]) + w),
        smooth(0.22, 0.15, dist(p, [0.12, 0.92, -0.2]) + w),
        smooth(0.2, 0.13, dist(p, [-0.05, 0.95, -0.65]) + w),
        tag === 'tail' ? smooth(0.2, 0.3, Math.sin(p[2] * 16) + w * 4) : 0
      );
      const black = Math.max(
        smooth(0.12, 0.07, dist(p, [-0.11, 1.21, 0.74]) + w),
        smooth(0.2, 0.13, dist(p, [-0.14, 0.92, 0.18]) + w),
        smooth(0.16, 0.1, dist(p, [0.1, 0.93, -0.5]) + w),
        tag === 'tail' ? smooth(0.1, 0.2, -Math.sin(p[2] * 16) + w * 4) : 0
      );
      const white = tag === 'muzzle' || tag === 'pad' || tag === 'chin' ? 1 : 0;
      const c = mixHex(mixHex('#fbf7f0', '#d9823a', orange * (1 - white)), '#2b2522', black * (1 - white));
      return c;
    },
    eye: { iris: '#a98a5c', rim: '#2a2320', lid: '#fbf7f0' },
    nose: '#eba0a8'
  }),
  kuro: cat({
    S: 0.22,
    girth: 1.05,
    head: 1.5,
    short: 0.84,
    bone: 1.2,
    paw: 1.1,
    ear: 0.98,
    eyeR: 1.06,
    pads: '#4a3a40',

    fur: { len: 0.038, layers: 7, cell: 0.0052 },
    furLen: furBase,
    paint: (p, n, tag) => (tag === 'earIn' ? '#4a3a40' : mixHex('#221f25', '#2e2a31', 0.5 + 0.5 * wobble(p, 5))),
    eye: { iris: '#b8963e', rim: '#141216', lid: '#221f25' },
    nose: '#3a3336'
  }),
  saba: cat({
    S: 0.22,
    girth: 1.1,
    head: 1.52,
    short: 0.84,
    bone: 1.2,
    paw: 1.1,
    ear: 0.98,
    eyeR: 1.06,

    fur: { len: 0.045, layers: 8, cell: 0.005 },
    furLen: furBase,
    paint: (p, n, tag) => {
      if (tag === 'earIn') return '#e3aaa8';
      const w = wobble(p, 6);
      let stripe: number;
      if (tag === 'skull' || tag === 'brow')
        stripe = smooth(0.3, 0.7, Math.sin(p[0] * 60 + w) * smooth(1.1, 1.2, p[1]));
      else if (tag === 'tail') stripe = smooth(0.2, 0.6, Math.sin(p[2] * 22 + w));
      else if (['fore', 'shin', 'arm', 'thigh', 'calf', 'meta', 'past'].includes(tag))
        stripe = smooth(0.3, 0.7, Math.sin(p[1] * 30 + w));
      else stripe = smooth(0.25, 0.65, Math.sin(p[2] * 17 + Math.abs(p[0]) * 3 + w * 1.5)) * smooth(0.55, 0.7, p[1]);
      const legs = ['fore', 'shin', 'arm', 'thigh', 'calf', 'meta', 'past', 'elbow', 'ham', 'flank'].includes(tag);
      const light =
        tag === 'muzzle' || tag === 'pad' || tag === 'chin'
          ? 1
          : tag === 'paw'
            ? 0.75
            : legs
              ? 0
              : smooth(0.6, 0.5, p[1] + 0.05 * w) * 0.8;
      return mixHex(mixHex('#8e9398', '#3f444a', stripe * (1 - light)), '#e4e6e6', light);
    },
    eye: { iris: '#8f9ea4', rim: '#2e3034', lid: '#8e9398' },
    nose: '#d99aa0'
  })
} satisfies Record<BreedId, Look>;

export const LOOKS: Record<BreedId, Look> = LOOKS_DATA;
