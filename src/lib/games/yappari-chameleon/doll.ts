import { bounds, field, mesh, type Shape, type Surface, type V3 } from '$lib/sculpt';

/**
 * 本家の白い人形。頭は小さな球で顔は描かず、首はほぼ無く頭が肩にめり込む。胴と手足は太く、手足は先のすぼまった
 * ソーセージで、足は靴の形を持たず脚の先が丸く終わる。継ぎ目を見せないよう 1 枚の面にして骨で曲げる。
 * 約 5.5 頭身で背は 1.15m（ダイニングの椅子の背より少し高い）
 */
export const BONES = [
  'hips',
  'spine',
  'chest',
  'head',
  'upperarm.l',
  'forearm.l',
  'upperarm.r',
  'forearm.r',
  'thigh.l',
  'shin.l',
  'thigh.r',
  'shin.r'
] as const;
export type Bone = (typeof BONES)[number];

export const HEIGHT = 1.15;

/** 腕は水平から 35 度下げた形で作る。真横に伸ばした形だと、下ろしたときに肩の面がつぶれる */
export const JOINTS: Record<Bone, V3> = {
  hips: [0, 0.5, 0],
  spine: [0, 0.62, 0],
  chest: [0, 0.74, 0],
  head: [0, 0.92, 0],
  'upperarm.l': [0.19, 0.86, 0],
  'forearm.l': [0.354, 0.745, 0],
  'upperarm.r': [-0.19, 0.86, 0],
  'forearm.r': [-0.354, 0.745, 0],
  'thigh.l': [0.09, 0.48, 0],
  'shin.l': [0.09, 0.27, 0],
  'thigh.r': [-0.09, 0.48, 0],
  'shin.r': [-0.09, 0.27, 0]
};

export const PARENT: Record<Bone, Bone | null> = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  head: 'chest',
  'upperarm.l': 'chest',
  'forearm.l': 'upperarm.l',
  'upperarm.r': 'chest',
  'forearm.r': 'upperarm.r',
  'thigh.l': 'hips',
  'shin.l': 'thigh.l',
  'thigh.r': 'hips',
  'shin.r': 'thigh.r'
};

const DEPTH: V3 = [1, 1, 0.78];

/**
 * 形のつなぎ（sculpt の smin）は、近い 2 つの面を k の 1/4 だけ外へ膨らませる。
 * 同じ軸で続く丸い円すい（ひざ・ひじ・手首・背骨と胸）は k = 0 でもなめらかにつながるので、
 * 0.004 でも 1mm の輪が出る。k は角度を付けてつながる所（肩・もものつけ根）だけに使う
 */
const FLUSH = 0;

function side(s: 1 | -1): Shape[] {
  const l = s === 1 ? 'l' : 'r';
  return [
    {
      a: [0.19 * s, 0.86, 0],
      cone: { b: [0.354 * s, 0.745, 0], ra: 0.07, rb: 0.066 },
      k: 0.055,
      bone: `upperarm.${l}`,
      tag: 'arm'
    },
    {
      a: [0.354 * s, 0.745, 0],
      cone: { b: [0.5 * s, 0.642, 0], ra: 0.066, rb: 0.06 },
      k: FLUSH,
      bone: `forearm.${l}`,
      tag: 'arm'
    },
    {
      a: [0.5 * s, 0.642, 0],
      cone: { b: [0.541 * s, 0.613, 0], ra: 0.06, rb: 0.058 },
      k: FLUSH,
      bone: `forearm.${l}`,
      tag: 'hand'
    },
    {
      a: [0.09 * s, 0.6, 0],
      cone: { b: [0.09 * s, 0.27, 0], ra: 0.07, rb: 0.066 },
      k: 0.015,
      bone: `thigh.${l}`,
      tag: 'leg'
    },
    // 足の形は作らず、すねの先の丸みがそのまま床に付く
    {
      a: [0.09 * s, 0.27, 0],
      cone: { b: [0.09 * s, 0.062, 0], ra: 0.066, rb: 0.062 },
      k: FLUSH,
      bone: `shin.${l}`,
      tag: 'leg'
    }
  ];
}

export function dollShapes(): Shape[] {
  return [
    { a: [0, 1.045, 0], ell: [0.105, 0.105, 0.105], k: 0.035, bone: 'head', tag: 'head' },
    {
      a: [0, 0.635, 0],
      cone: { b: [0, 0.665, 0], ra: 0.155, rb: 0.158 },
      squash: DEPTH,
      k: FLUSH,
      bone: 'hips',
      tag: 'body'
    },
    {
      a: [0, 0.665, 0],
      cone: { b: [0, 0.74, 0], ra: 0.158, rb: 0.165 },
      squash: DEPTH,
      k: FLUSH,
      bone: 'spine',
      tag: 'body'
    },
    {
      a: [0, 0.74, 0],
      cone: { b: [0, 0.8, 0], ra: 0.165, rb: 0.175 },
      squash: DEPTH,
      k: FLUSH,
      bone: 'chest',
      tag: 'body'
    },
    ...side(1),
    ...side(-1)
  ];
}

export interface DollSurface extends Surface {
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
}

/** 形ごとの距離から骨の重さを決める（pet-house の models.ts と同じ式）。近い形ほど重く、上位 4 本の骨に付ける */
export function buildDoll(h = 0.015): DollSurface {
  const shapes = dollShapes();
  const f = field(shapes);
  const s = mesh(f, bounds(shapes, h * 2), h);
  const n = s.pos.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const d = new Float64Array(f.count);
  const perBone = new Float64Array(BONES.length);
  const boneOf = shapes.map((sh) => BONES.indexOf(sh.bone as Bone));
  for (let v = 0; v < n; v++) {
    f.each(s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2], d);
    let dmin = Infinity;
    for (let i = 0; i < shapes.length; i++) dmin = Math.min(dmin, d[i]);
    perBone.fill(0);
    for (let i = 0; i < shapes.length; i++) {
      const w = Math.max(0, 1 - (d[i] - dmin) / Math.max(shapes[i].k, 0.02)) ** 2;
      perBone[boneOf[i]] += w;
    }
    const top = [...perBone.keys()].sort((a, b) => perBone[b] - perBone[a]).slice(0, 4);
    const total = top.reduce((t, i) => t + perBone[i], 0);
    top.forEach((b, k) => {
      skinIndex[v * 4 + k] = b;
      skinWeight[v * 4 + k] = perBone[b] / total;
    });
  }
  return { ...s, skinIndex, skinWeight };
}
