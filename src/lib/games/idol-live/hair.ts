import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, SkinnedMesh, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CENTER, headPoint } from './head';
import { aim, Rig, SIZE, sign, type Side } from './rig';
import { blendBones, strand } from './shapes';
import { outline, toon } from './toon';

/**
 * 髪。頭にかぶせた地肌の上に、前髪・横髪・うしろ髪・アホ毛の毛束を重ね、ツインテールは骨の鎖で揺らす。
 * 前髪などは頭の骨の子（頭の枠で作る）、ツインテールは世界の座標で作って鎖の骨に重さを付ける
 */

export const HAIR = { root: '#f2679f', tip: '#ffb3d4', shade: '#c98ac0', line: '#a8386e' };

const root = new Color(HAIR.root);
const tip = new Color(HAIR.tip);
const paint = (t: number) => root.clone().lerp(tip, Math.min(1, t * 1.1));

/** 頭の面の向き（前が az = 0、右回り。el は上へ）から、面より k 倍外の点（頭の枠） */
function surf(az: number, el: number, k: number): Vector3 {
  const d = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return headPoint(d).multiplyScalar(k).add(CENTER);
}

const outward = (p: Vector3) => p.clone().sub(CENTER).normalize();

function lock(points: Vector3[], width: number, thick: number, out = outward) {
  return strand(points, {
    width: (t) => width * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12))) * (1 - t ** 3),
    thick: (t) => thick * (1 - 0.7 * t),
    out,
    paint
  });
}

/** 頭にかぶる地肌。顔と額は空けておく */
function cap(): BufferGeometry {
  const g = new SphereGeometry(1, 48, 36);
  const pos = g.attributes.position;
  const d = new Vector3();
  const keep: boolean[] = [];
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i);
    d.set(-d.x, d.y, -d.z).normalize();
    keep.push(!(d.z > 0.15 && d.y < 0.62) && d.y > -0.55);
    const p = headPoint(d).multiplyScalar(1.045).add(CENTER);
    pos.setXYZ(i, p.x, p.y, p.z);
    const c = root.clone().lerp(tip, 0.1);
    col.push(c.r, c.g, c.b);
  }
  const idx: number[] = [];
  const src = g.index!;
  for (let t = 0; t < src.count; t += 3) {
    const tri = [src.getX(t), src.getX(t + 1), src.getX(t + 2)];
    if (tri.every((i) => keep[i])) idx.push(...tri);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', pos);
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

/** 頭の骨に付く髪（地肌・前髪・横髪・うしろ髪・アホ毛）を 1 つの形にまとめる */
function headHair(): BufferGeometry {
  const parts: BufferGeometry[] = [cap()];
  // 前髪。幅のある毛束を 2 重に重ね、長さを変えて、毛先は額へ沿わせる。真ん中は目のあいだまで下ろす
  const bangs: [number, number, number][] = [
    [-1.08, -0.3, 0.026],
    [-0.84, -0.08, 0.03],
    [-0.6, 0.18, 0.03],
    [-0.38, 0.27, 0.028],
    [-0.18, 0.1, 0.028],
    [0.0, -0.04, 0.026],
    [0.18, 0.12, 0.028],
    [0.38, 0.27, 0.028],
    [0.6, 0.18, 0.03],
    [0.84, -0.08, 0.03],
    [1.08, -0.3, 0.026]
  ];
  for (const [az, el, w] of bangs)
    parts.push(
      lock([surf(az * 0.35, 1.3, 1.03), surf(az * 0.72, 0.95, 1.1), surf(az * 0.92, 0.55, 1.12), surf(az * 0.98, (0.55 + el) / 2, 1.1), surf(az, el, 1.06)], w, 0.008)
    );
  for (const az of [-0.7, -0.25, 0.25, 0.7])
    parts.push(lock([surf(az * 0.3, 1.3, 1.02), surf(az * 0.8, 0.85, 1.08), surf(az, 0.45, 1.1)], 0.034, 0.008));
  // 横髪。こめかみから、ほおにそってあごの下まで
  for (const s of [-1, 1])
    for (const [back, len] of [
      [0, 0.18],
      [0.25, 0.24]
    ]) {
      const a = surf(s * (1.15 + back), 0.9, 1.03);
      const b = surf(s * (1.38 + back), 0.25, 1.1);
      const c = new Vector3(s * (0.088 + back * 0.04), CENTER.y - 0.07, 0.045 - back * 0.08);
      const d = new Vector3(s * (0.072 + back * 0.05), CENTER.y - len, 0.038 - back * 0.1);
      parts.push(lock([a, b, c, d], 0.024, 0.009, (p) => new Vector3(s, 0, 0.5).add(outward(p)).normalize()));
    }
  // うしろ髪。つむじから首のうしろへ、少し外へ広げて
  for (let i = 0; i < 11; i++) {
    const az = Math.PI * (0.55 + (0.9 * i) / 10);
    const flare = new Vector3(Math.sin(az) * 0.105, CENTER.y - 0.2 - 0.025 * Math.sin(i * 1.7) ** 2, Math.cos(az) * 0.095 - 0.02);
    parts.push(lock([surf(az, 1.2, 1.03), surf(az, 0.45, 1.1), surf(az, -0.35, 1.13), flare], 0.05, 0.012));
  }
  // アホ毛
  parts.push(
    lock(
      [
        new Vector3(0, CENTER.y + 0.1, 0.01),
        new Vector3(0.008, CENTER.y + 0.15, 0.03),
        new Vector3(0.03, CENTER.y + 0.175, 0.07),
        new Vector3(0.05, CENTER.y + 0.155, 0.085)
      ],
      0.009,
      0.004,
      () => new Vector3(1, 0, 0)
    )
  );
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** ツインテール（世界の座標）。骨の鎖に沿って、ふくらんで細くなる毛束の束 */
function tail(rig: Rig, s: Side): BufferGeometry {
  const k = sign(s);
  const R = rig.at(`tail${s}0`);
  const n = SIZE.tail.n;
  const len = n * SIZE.tail.len;
  const bone = (i: number) => rig.skeleton.bones.indexOf(rig.bones[`tail${s}${Math.max(0, Math.min(n - 1, i))}`]);
  const parts: BufferGeometry[] = [];
  for (let j = 0; j < 7; j++) {
    const a0 = (j / 7) * Math.PI * 2;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const r = 0.02 + 0.058 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6 * (1 - 0.4 * t);
      const a = a0 + t * 1.3;
      pts.push(new Vector3(R.x + Math.cos(a) * r, R.y - len * t, R.z + Math.sin(a) * r * 0.8));
    }
    const axis = (p: Vector3) => new Vector3(p.x - R.x, 0, p.z - R.z).normalize();
    parts.push(
      strand(pts, {
        width: (t) => 0.032 * (1 - t ** 2.5) + 0.002,
        thick: (t) => 0.012 * (1 - 0.6 * t),
        out: axis,
        paint,
        segments: 18,
        skin: (t) => {
          const f = t * n;
          const j = Math.round(f);
          if (j <= 0) return [[bone(0), 1]];
          if (j >= n) return [[bone(n - 1), 1]];
          return blendBones(bone(j - 1), bone(j), f - j, 0.7);
        }
      })
    );
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** ツインテールの揺れ。鎖の点を重さと速さで動かし、長さを保ち、頭と体を突き抜けないよう押し出す */
class Chain {
  readonly #p: Vector3[] = [];
  readonly #q: Vector3[] = [];
  readonly #side: Side;
  #ready = false;

  constructor(side: Side) {
    this.#side = side;
    for (let i = 0; i <= SIZE.tail.n; i++) {
      this.#p.push(new Vector3());
      this.#q.push(new Vector3());
    }
  }

  step(rig: Rig, dt: number) {
    const s = this.#side;
    const k = sign(s);
    const n = SIZE.tail.n;
    const L = SIZE.tail.len;
    const head = rig.bones.head;
    const origin = rig.at(`tail${s}0`);
    // 何もなければ、頭の向きで外うしろへ少し広がって垂れる
    const dir = (i: number) => {
      // 根元は外うしろへ跳ね上げ、先へ行くほど下へ垂れる
      const u = i / n;
      const d = new Vector3(k * (0.8 - u * 0.75), -0.55 - u * 1.4, -0.4 + u * 0.25).normalize().transformDirection(head.matrixWorld);
      d.y = Math.min(d.y, -0.3 - u);
      return d.normalize();
    };
    const rest = dir(0);
    if (!this.#ready) {
      for (let i = 0; i <= n; i++) {
        this.#p[i].copy(i ? this.#p[i - 1] : origin).addScaledVector(i ? dir(i - 1) : rest, i ? L : 0);
        this.#q[i].copy(this.#p[i]);
      }
      this.#ready = true;
    }
    const h = Math.min(dt, 1 / 30);
    const center = new Vector3().copy(CENTER).applyMatrix4(head.matrixWorld);
    const chest = rig.at('chest').add(new Vector3(0, 0.06, -0.02));
    const hips = rig.at('hips');
    this.#p[0].copy(origin);
    for (let i = 1; i <= n; i++) {
      const p = this.#p[i];
      const q = this.#q[i];
      const v = p.clone().sub(q).multiplyScalar(0.94);
      q.copy(p);
      // 根元ほど形を保つ力が強い
      const want = this.#p[i - 1].clone().addScaledVector(dir(i - 1), L);
      const stiff = 0.3 * (1 - i / (n + 1)) ** 1.5;
      p.add(v).addScaledVector(want.sub(p), stiff).add(new Vector3(0, -9.8 * h * h, 0));
    }
    for (let it = 0; it < 3; it++)
      for (let i = 1; i <= n; i++) {
        const a = this.#p[i - 1];
        const p = this.#p[i];
        p.sub(a).setLength(L).add(a);
        push(p, center, 0.125);
        push(p, chest, 0.14);
        push(p, hips, 0.17);
      }
    for (let i = 0; i < n; i++) {
      const b = rig.bones[`tail${s}${i}`];
      const d = this.#p[i + 1].clone().sub(this.#p[i]);
      aim(b, d, new Vector3(0, 0, 1).transformDirection(head.matrixWorld), new Vector3(1, 0, 0));
    }
  }
}

function push(p: Vector3, c: Vector3, r: number) {
  const d = p.clone().sub(c);
  const l = d.length();
  if (l < r && l > 1e-6) p.copy(c).addScaledVector(d, r / l);
}

export class Hair {
  /** 頭の骨に付ける */
  readonly head = new Group();
  /** 世界に置く（骨で動く） */
  readonly tails: SkinnedMesh[] = [];
  readonly #chains = [new Chain('L'), new Chain('R')];

  constructor(rig: Rig) {
    const mat = toon({ vertexColors: true, shade: HAIR.shade, gloss: 0.5, rim: 0.5 });
    const line = outline(HAIR.line, 0.0016);
    const g = headHair();
    this.head.add(new Mesh(g, mat), new Mesh(g, line));
    for (const s of ['L', 'R'] as const) {
      const tg = tail(rig, s);
      for (const m of [mat, line]) {
        const mesh = new SkinnedMesh(tg, m);
        mesh.bind(rig.skeleton);
        mesh.frustumCulled = false;
        this.tails.push(mesh);
      }
    }
  }

  /** かっこうを当てたあとに毎フレーム呼ぶ */
  update(rig: Rig, dt: number) {
    for (const c of this.#chains) c.step(rig, dt);
  }
}
