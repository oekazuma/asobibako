import { Color, Group, Mesh, SkinnedMesh, SphereGeometry, CapsuleGeometry, type BufferGeometry } from 'three';
import type { Grip } from './dance';
import { Rig, SIZE, sign, type BoneName, type Side } from './rig';
import { blendBones, column, type Ring } from './shapes';
import { outline, toon } from './toon';

/**
 * 体（胴・腕・脚は骨で曲がる 1 枚の皮、手と靴は骨の子）。立った姿の世界の座標で作る。
 * 服のうち体にぴったりの部分（身ごろ・手袋・ブーツ）は、この皮の色の塗り分けで表す
 */

export const SKIN = '#ffe6da';
const SKIN_SHADE = '#f4b7b4';
const SKIN_LINE = '#c98a8a';

/** 高さ y・向き a（前が 0）の点の色。服の塗り分けを返す */
export type Paint = (y: number, a: number) => Color;
export interface BodyPaint {
  torso: Paint;
  arm: Paint;
  leg: Paint;
}

const skin = new Color(SKIN);
export const bare: BodyPaint = { torso: () => skin, arm: () => skin, leg: () => skin };

const TORSO: Ring[] = [
  [0.72, 0.03, 0.03],
  [0.75, 0.1, 0.075],
  [0.8, 0.128, 0.09, -0.005],
  [0.87, 0.13, 0.092, -0.008],
  [0.94, 0.114, 0.08, -0.004],
  [1.0, 0.092, 0.068],
  [1.06, 0.098, 0.071, 0.003],
  [1.12, 0.11, 0.08, 0.012],
  [1.16, 0.114, 0.082, 0.015],
  [1.2, 0.12, 0.074, 0.004],
  [1.24, 0.128, 0.067, -0.006],
  [1.262, 0.126, 0.061, -0.008],
  [1.28, 0.108, 0.056, -0.008],
  [1.295, 0.07, 0.048, -0.007],
  [1.31, 0.036, 0.036],
  [1.36, 0.031, 0.032, 0.004],
  [1.39, 0.02, 0.02]
];

/** 肩の付け根（上腕の骨の高さ）から下へ */
const ARM: Ring[] = [
  [0.02, 0.026, 0.026],
  [0, 0.033, 0.033],
  [-0.08, 0.029, 0.029],
  [-0.18, 0.025, 0.025],
  [-0.25, 0.021, 0.02],
  [-0.31, 0.023, 0.022],
  [-0.4, 0.019, 0.017],
  [-0.46, 0.014, 0.013],
  [-0.48, 0.012, 0.011]
];

const LEG: Ring[] = [
  [0.87, 0.066, 0.068],
  [0.8, 0.069, 0.071],
  [0.65, 0.057, 0.059],
  [0.5, 0.046, 0.049],
  [0.42, 0.039, 0.041],
  [0.33, 0.042, 0.045, -0.005],
  [0.2, 0.033, 0.035],
  [0.09, 0.023, 0.025],
  [0.05, 0.021, 0.023],
  [0.03, 0.018, 0.02]
];

export class Body {
  readonly skinned: SkinnedMesh[] = [];
  readonly #rig: Rig;
  readonly #geos: { g: BufferGeometry; part: keyof BodyPaint; x: number; z: number }[] = [];
  readonly #hands = new Map<Side, Map<Grip, Group>>();

  constructor(rig: Rig) {
    this.#rig = rig;
    const idx = (n: BoneName) => rig.skeleton.bones.indexOf(rig.bones[n]);
    /** list は下から順に [関節の高さ, 下の骨, 上の骨, なじませる幅]。fallback はいちばん下の骨 */
    const joint = (y: number, list: [number, BoneName, BoneName, number][], fallback: BoneName) => {
      for (const [at, a, b, width] of list) if (Math.abs(y - at) < width) return blendBones(idx(a), idx(b), y - at, width * 2);
      let best: BoneName = fallback;
      for (const [at, , b] of list) if (y > at) best = b;
      return [[idx(best), 1]] as [number, number][];
    };
    const mat = toon({ vertexColors: true, shade: SKIN_SHADE, rim: 0.35 });
    const line = outline(SKIN_LINE, 0.0016);
    const add = (part: keyof BodyPaint, ring: Ring[], x: number, z: number, weights: (y: number) => [number, number][]) => {
      const g = column(ring, { x, z, skin: weights, paint: bare[part], caps: true });
      this.#geos.push({ g, part, x, z });
      for (const m of [mat, line]) {
        const mesh = new SkinnedMesh(g, m);
        mesh.bind(rig.skeleton);
        mesh.frustumCulled = false;
        this.skinned.push(mesh);
      }
    };
    const up = SIZE.hips + SIZE.spine;
    const chest = up + SIZE.chest;
    const neck = chest + SIZE.neck;
    add('torso', TORSO, 0, 0, (y) =>
      joint(
        y,
        [
          [up, 'hips', 'spine', 0.05],
          [chest, 'spine', 'chest', 0.05],
          [neck, 'chest', 'neck', 0.025],
          [neck + SIZE.head, 'neck', 'head', 0.02]
        ],
        'hips'
      )
    );
    for (const s of ['L', 'R'] as const) {
      const k = sign(s);
      const sh = rig.at(`upper${s}`);
      const elbow = sh.y - SIZE.upper;
      const wrist = elbow - SIZE.fore;
      add('arm', ARM.map(([y, ...r]) => [y + sh.y, ...r] as Ring), sh.x, sh.z, (y) =>
        joint(
          y,
          [
            [wrist, `hand${s}`, `fore${s}`, 0.01],
            [elbow, `fore${s}`, `upper${s}`, 0.025]
          ],
          `hand${s}`
        )
      );
      const hip = rig.at(`thigh${s}`);
      const knee = hip.y - SIZE.thigh;
      const ankle = knee - SIZE.shin;
      add('leg', LEG, k * SIZE.hip.x, 0, (y) =>
        joint(
          y,
          [
            [ankle, `foot${s}`, `shin${s}`, 0.01],
            [knee, `shin${s}`, `thigh${s}`, 0.03]
          ],
          `foot${s}`
        )
      );
      this.#hands.set(s, hands(rig, s));
    }
  }

  /** 服の塗り分けを当てなおす */
  paint(p: BodyPaint): void {
    for (const { g, part, x: cx, z: cz } of this.#geos) {
      const pos = g.attributes.position;
      const col = g.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const c = p[part](y, Math.atan2(x - cx, z - cz));
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
  }

  grip(s: Side, g: Grip): void {
    for (const [k, m] of this.#hands.get(s)!) m.visible = k === g;
  }

  get rig(): Rig {
    return this.#rig;
  }
}

/** 小さな手。にぎり方ごとに形を持ち、見せる形だけを出す */
function hands(rig: Rig, s: Side): Map<Grip, Group> {
  const mat = toon({ color: SKIN, shade: SKIN_SHADE, rim: 0.3 });
  const line = outline(SKIN_LINE, 0.0014);
  const part = (g: BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) => {
    const grp = new Group();
    for (const m of [mat, line]) {
      const mesh = new Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.z = rz;
      grp.add(mesh);
    }
    return grp;
  };
  const ball = new SphereGeometry(1, 16, 12);
  const finger = new CapsuleGeometry(0.0055, 0.03, 4, 8);
  const k = sign(s);
  const make = (...parts: Group[]) => {
    const g = new Group();
    g.add(...parts);
    g.visible = false;
    rig.bones[`hand${s}`].add(g);
    return g;
  };
  const thumb = () => part(ball, -k * 0.016, -0.02, 0.008, 0.007, 0.014, 0.007, -k * 0.5);
  const map = new Map<Grip, Group>([
    ['open', make(part(ball, 0, -0.035, 0, 0.021, 0.038, 0.01), thumb())],
    ['fist', make(part(ball, 0, -0.026, 0.002, 0.02, 0.025, 0.017), thumb())],
    ['heart', make(part(ball, 0, -0.03, 0.004, 0.018, 0.03, 0.013), thumb())],
    ['point', make(part(ball, 0, -0.024, 0.002, 0.019, 0.023, 0.016), part(finger, k * 0.006, -0.058, 0.004, 1, 1, 1))],
    [
      'v',
      make(
        part(ball, 0, -0.024, 0.002, 0.019, 0.023, 0.016),
        part(finger, k * 0.012, -0.056, 0.004, 1, 1, 1, k * 0.25),
        part(finger, -k * 0.004, -0.058, 0.004, 1, 1, 1, -k * 0.1)
      )
    ]
  ]);
  map.get('open')!.visible = true;
  return map;
}
