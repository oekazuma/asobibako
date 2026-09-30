import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bounds, field, mesh as surface, type Shape, type V3 } from '$lib/sculpt';

/**
 * 頭の大きい 2 頭身の子を、なめらかな 1 枚の体（体・髪は別の 1 枚）で作り、骨で曲げる。
 * 色は頂点に塗り、段のある影（トゥーン）と細いふち取りでアニメ調に描く。前は -z、足もとが y = 0
 */

export interface Style {
  skin: string;
  shirt: string;
  /** 下の服。skirt ならスカート、そうでなければ半ズボン */
  bottom: string;
  skirt: boolean;
  sock: string;
  shoe: string;
  hair: string;
  /** 髪の形 */
  cut: 'twin' | 'bob' | 'short' | 'pony';
  ribbon?: string;
  glasses?: string;
}

const BONES: [string, string | null, V3][] = [
  ['hips', null, [0, 0.5, 0]],
  ['chest', 'hips', [0, 0.66, 0]],
  ['head', 'chest', [0, 0.86, 0]],
  ['armL', 'chest', [0.17, 0.8, 0]],
  ['handL', 'armL', [0.23, 0.63, 0]],
  ['armR', 'chest', [-0.17, 0.8, 0]],
  ['handR', 'armR', [-0.23, 0.63, 0]],
  ['legL', 'hips', [0.085, 0.44, 0]],
  ['footL', 'legL', [0.085, 0.24, 0]],
  ['legR', 'hips', [-0.085, 0.44, 0]],
  ['footR', 'legR', [-0.085, 0.24, 0]],
  ['tailL', 'head', [0.22, 1.12, 0.06]],
  ['tailR', 'head', [-0.22, 1.12, 0.06]]
];

const ell = (a: V3, r: V3, bone: string, tag: string, k = 0.03, extra: Partial<Shape> = {}): Shape => ({
  a,
  ell: r,
  bone,
  tag,
  k,
  ...extra
});
const cone = (a: V3, b: V3, ra: number, rb: number, bone: string, tag: string, k = 0.025): Shape => ({
  a,
  cone: { b, ra, rb },
  bone,
  tag,
  k
});

function bodyShapes(st: Style): Shape[] {
  const s: Shape[] = [
    ell([0, 0.69, 0], [0.155, 0.16, 0.12], 'chest', 'shirt', 0.05),
    cone([0, 0.8, 0], [0, 0.9, 0], 0.05, 0.05, 'head', 'skin', 0.03),
    ell([0, 1.08, 0], [0.26, 0.235, 0.235], 'head', 'skin', 0.05),
    ell([0.13, 1.0, -0.14], [0.07, 0.06, 0.05], 'head', 'skin', 0.06),
    ell([-0.13, 1.0, -0.14], [0.07, 0.06, 0.05], 'head', 'skin', 0.06)
  ];
  // スカートは平たい楕円体を 2 段に重ねた、裾へ広がるベルの形。丸い円すいでは裾まで丸くなって玉に見える
  if (st.skirt)
    s.push(
      ell([0, 0.575, 0], [0.15, 0.06, 0.125], 'hips', 'bottom', 0.02),
      ell([0, 0.51, 0], [0.205, 0.045, 0.17], 'hips', 'bottom', 0.03)
    );
  else s.push(ell([0, 0.52, 0], [0.15, 0.1, 0.11], 'hips', 'bottom', 0.04));
  for (const side of [1, -1]) {
    const L = side > 0 ? 'L' : 'R';
    s.push(
      cone([side * 0.15, 0.79, 0], [side * 0.225, 0.64, 0.005], 0.052, 0.045, `arm${L}`, 'shirt'),
      cone([side * 0.225, 0.64, 0.005], [side * 0.245, 0.52, -0.01], 0.04, 0.036, `hand${L}`, 'skin'),
      ell([side * 0.248, 0.49, -0.015], [0.045, 0.05, 0.04], `hand${L}`, 'skin', 0.02),
      cone([side * 0.085, 0.46, 0], [side * 0.085, 0.25, 0], 0.058, 0.048, `leg${L}`, 'skin'),
      cone([side * 0.085, 0.25, 0], [side * 0.085, 0.07, 0], 0.048, 0.042, `foot${L}`, 'sock'),
      ell([side * 0.085, 0.045, -0.035], [0.055, 0.045, 0.09], `foot${L}`, 'shoe', 0.02)
    );
  }
  return s;
}

function hairShapes(st: Style): Shape[] {
  const s: Shape[] = [
    // 頭を後ろ上から包む帽子のような形。顔の前は開けておく
    ell([0, 1.12, 0.035], [0.275, 0.25, 0.25], 'head', 'hair', 0.02),
    // 前髪。おでこに沿って 5 つ並べ、毛先を少し下げる
    ...[-0.16, -0.08, 0, 0.08, 0.16].map((x, i) =>
      ell([x, 1.19 - (i % 2) * 0.015, -0.19 + Math.abs(x) * 0.25], [0.075, 0.085, 0.05], 'head', 'hair', 0.03)
    ),
    ell([0.21, 1.02, -0.06], [0.06, 0.13, 0.07], 'head', 'hair', 0.03),
    ell([-0.21, 1.02, -0.06], [0.06, 0.13, 0.07], 'head', 'hair', 0.03)
  ];
  if (st.cut === 'twin')
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      s.push(
        ell([side * 0.25, 1.13, 0.07], [0.07, 0.07, 0.07], `tail${L}`, 'hair', 0.03),
        cone([side * 0.27, 1.1, 0.08], [side * 0.34, 0.72, 0.12], 0.085, 0.035, `tail${L}`, 'hair', 0.04)
      );
    }
  else if (st.cut === 'bob') s.push(ell([0, 1.0, 0.06], [0.285, 0.17, 0.22], 'head', 'hair', 0.05));
  else if (st.cut === 'pony') s.push(cone([0, 1.2, 0.2], [0, 0.88, 0.32], 0.08, 0.035, 'head', 'hair', 0.05));
  return s;
}

const tone = (() => {
  let t: THREE.DataTexture | null = null;
  return () => {
    if (t) return t;
    // 3 段の明るさ。暗い段も色を残して、影が汚れて見えないようにする
    const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
    t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  };
})();

function toon() {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tone() });
}

/** 体を法線の向きへ少しふくらませて裏だけを描く、ふち取りの材質 */
function outline(width: number) {
  const m = new THREE.MeshBasicMaterial({ color: '#3a2a33', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ${width.toFixed(4)};`
    );
  };
  m.customProgramCacheKey = () => `outline-${width}`;
  return m;
}

function paint(tag: string, st: Style): string {
  if (tag === 'skin') return st.skin;
  if (tag === 'shirt') return st.shirt;
  if (tag === 'bottom') return st.bottom;
  if (tag === 'sock') return st.sock;
  if (tag === 'shoe') return st.shoe;
  return st.hair;
}

/** 形の並びを、頂点の色と骨の重さを付けた BufferGeometry にする */
function build(shapes: Shape[], st: Style, h: number, names: string[]) {
  const f = field(shapes);
  const s = surface(f, bounds(shapes, 0.04), h);
  const n = s.pos.length / 3;
  const colors = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const d = new Float64Array(f.count);
  const perBone = new Float64Array(names.length);
  const boneOf = shapes.map((sh) => names.indexOf(sh.bone));
  const c = new THREE.Color();
  const acc = new THREE.Color();
  for (let v = 0; v < n; v++) {
    const [x, y, z] = [s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2]];
    f.each(x, y, z, d);
    let dmin = Infinity;
    for (let i = 0; i < shapes.length; i++) dmin = Math.min(dmin, d[i]);
    perBone.fill(0);
    acc.setRGB(0, 0, 0);
    let csum = 0;
    for (let i = 0; i < shapes.length; i++) {
      const w = Math.max(0, 1 - (d[i] - dmin) / Math.max(shapes[i].k, 0.02)) ** 2;
      if (w <= 0) continue;
      perBone[boneOf[i]] += w;
      // 色は重さを強く尖らせて混ぜる。いちばん近い形の色だけにすると、粗い三角形の境目がギザギザに見える
      const wc = Math.max(0, 1 - (d[i] - dmin) / 0.012) ** 3;
      acc.add(c.set(paint(shapes[i].tag, st)).multiplyScalar(wc));
      csum += wc;
    }
    acc.multiplyScalar(1 / (csum || 1));
    colors.set([acc.r, acc.g, acc.b], v * 3);
    const top = [...perBone.keys()].sort((a, b) => perBone[b] - perBone[a]).slice(0, 4);
    const tw = top.reduce((t, i) => t + perBone[i], 0) || 1;
    top.forEach((b, k) => {
      skinIndex[v * 4 + k] = b;
      skinWeight[v * 4 + k] = perBone[b] / tw;
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(s.idx, 1));
  return g;
}

const cache = new Map<string, { body: THREE.BufferGeometry; hair: THREE.BufferGeometry }>();

const faceCache = new Map<string, THREE.BufferGeometry>();
const faceMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const toonMat = toon();
const lineMat = outline(0.008);

/**
 * 顔。大きな黒目に白い光を 2 つ、ほお紅、口、めがね、リボン。
 * 部品ごとに描くと人数ぶん描く回数が増えるので、色を頂点に塗った 1 つの形にまとめ、頭の骨に付ける
 */
function faceGeo(st: Style): THREE.BufferGeometry {
  const key = `${st.glasses ?? ''}|${st.ribbon ?? ''}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const hy = 1.08 - 0.86;
  const ball = new THREE.SphereGeometry(1, 16, 12);
  const ring = new THREE.TorusGeometry(0.058, 0.009, 8, 28);
  const parts: THREE.BufferGeometry[] = [];
  const put = (base: THREE.BufferGeometry, color: string, pos: V3, scale: V3, turn = 0) => {
    const g = base.clone();
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, turn, 0)),
        new THREE.Vector3(...scale)
      )
    );
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]),
        3
      )
    );
    parts.push(g);
  };
  for (const side of [1, -1]) {
    put(ball, '#2b1d2e', [side * 0.088, hy - 0.035, -0.222], [0.042, 0.058, 0.02], side * 0.35);
    put(ball, st.glasses ? '#3b8f6a' : '#6b3fa0', [side * 0.09, hy - 0.048, -0.232], [0.03, 0.036, 0.012], side * 0.35);
    put(ball, '#ffffff', [side * 0.1, hy - 0.017, -0.238], [0.014, 0.014, 0.014]);
    put(ball, '#ffffff', [side * 0.076, hy - 0.057, -0.238], [0.007, 0.007, 0.007]);
    put(ball, '#ffb3c1', [side * 0.14, hy - 0.1, -0.205], [0.035, 0.018, 0.01], side * 0.55);
    if (st.glasses) put(ring, st.glasses, [side * 0.09, hy - 0.04, -0.245], [1, 1, 1], side * 0.3);
    if (st.ribbon) put(ball, st.ribbon, [side * 0.24, 1.2 - 0.86, 0.05], [0.045, 0.035, 0.03]);
  }
  put(ball, '#b8404f', [0, hy - 0.115, -0.228], [0.022, 0.012, 0.01]);
  const merged = mergeGeometries(parts)!;
  faceCache.set(key, merged);
  return merged;
}

function geometry(st: Style, detail: number) {
  const names = BONES.map((b) => b[0]);
  const key = JSON.stringify(st) + detail;
  let geo = cache.get(key);
  if (!geo) {
    geo = { body: build(bodyShapes(st), st, detail, names), hair: build(hairShapes(st), st, detail, names) };
    cache.set(key, geo);
  }
  return geo;
}

export interface Chara {
  group: THREE.Group;
  bones: Record<string, THREE.Bone>;
  style: Style;
  detail: number;
  /** 体と、その裏のふち取り。ファンになったときに服の色の違う形へ差し替える */
  bodies: THREE.SkinnedMesh[];
}

/** 子を 1 人組み立てる。形は style ごとに一度だけ作って使い回し、骨は 1 人ずつ持つ */
export function chara(st: Style, detail = 0.014): Chara {
  const names = BONES.map((b) => b[0]);
  const geo = geometry(st, detail);
  const bones: Record<string, THREE.Bone> = {};
  for (const [name, parent, at] of BONES) {
    const b = new THREE.Bone();
    b.name = name;
    const p = parent ? BONES.find((x) => x[0] === parent)![2] : [0, 0, 0];
    b.position.set(at[0] - p[0], at[1] - p[1], at[2] - p[2]);
    if (parent) bones[parent].add(b);
    bones[name] = b;
  }
  const group = new THREE.Group();
  group.add(bones.hips);
  // 骨の逆行列は Skeleton を作った時点の位置で決まるので、先に位置を確定させておく
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(names.map((n) => bones[n]));
  const make = (g: THREE.BufferGeometry, m: THREE.Material, shadow: boolean) => {
    const sm = new THREE.SkinnedMesh(g, m);
    sm.bind(skeleton);
    sm.castShadow = shadow;
    // 走ると骨が外へ動くので、最初の形の箱で見切られて消えないようにする
    sm.frustumCulled = false;
    group.add(sm);
    return sm;
  };
  const body = make(geo.body, toonMat, true);
  make(geo.hair, toonMat, true);
  const bodyLine = make(geo.body, lineMat, false);
  make(geo.hair, lineMat, false);
  bones.head.add(new THREE.Mesh(faceGeo(st), faceMat));
  return { group, bones, style: st, detail, bodies: [body, bodyLine] };
}

/** ファンになった子は、ピンクの服の形に差し替える（形は服の色ごとに一度だけ作る） */
export function recolor(c: Chara, shirt: string) {
  const geo = geometry({ ...c.style, shirt }, c.detail);
  for (const m of c.bodies) m.geometry = geo.body;
}

/** 走るかっこう。phase は足の振りの位相、amount は振りの大きさ（0 で止まる） */
export function run(c: Chara, phase: number, amount: number, cheer = false) {
  const a = Math.sin(phase) * amount;
  const b = c.bones;
  b.legL.rotation.x = a * 0.9;
  b.legR.rotation.x = -a * 0.9;
  b.footL.rotation.x = Math.max(0, -a) * 1.2;
  b.footR.rotation.x = Math.max(0, a) * 1.2;
  if (cheer) {
    // ファンは両手を上げて振る
    b.armL.rotation.z = 2.4 + Math.sin(phase * 2) * 0.3;
    b.armR.rotation.z = -2.4 - Math.sin(phase * 2) * 0.3;
    b.armL.rotation.x = b.armR.rotation.x = 0;
  } else {
    b.armL.rotation.x = -a * 0.9;
    b.armR.rotation.x = a * 0.9;
    b.armL.rotation.z = 0.25;
    b.armR.rotation.z = -0.25;
  }
  b.chest.rotation.y = a * 0.15;
  b.head.rotation.x = Math.abs(a) * 0.05;
  b.tailL.rotation.z = 0.2 + Math.sin(phase + 1) * 0.15 * amount;
  b.tailR.rotation.z = -0.2 - Math.sin(phase + 1.3) * 0.15 * amount;
  b.tailL.rotation.x = b.tailR.rotation.x = -0.2 * amount;
}

export const HERO: Style = {
  skin: '#ffe1cc',
  shirt: '#ffb6c9',
  bottom: '#34426b',
  skirt: true,
  sock: '#ffffff',
  shoe: '#5b3a29',
  hair: '#2a5a4c',
  cut: 'twin',
  ribbon: '#ff4d6d',
  glasses: '#39c28a'
};

const SHIRTS = ['#ffffff', '#8fc3ff', '#ffd166', '#9be3a8', '#c7a6ff', '#ffa98a'];
const HAIRS = ['#3b2a20', '#1f1d2a', '#8a5a2b', '#d9a441', '#5a3a5a'];
const CUTS: Style['cut'][] = ['bob', 'short', 'pony', 'short', 'bob'];

/** 通行人の見た目。数が多いので、組み合わせを 8 通りに絞って形を使い回す */
export function passer(seed: number): Style {
  const i = seed % 8;
  return {
    skin: i % 3 === 2 ? '#f0c8a8' : '#ffe1cc',
    shirt: SHIRTS[i % SHIRTS.length],
    bottom: i % 2 ? '#3e4a6a' : '#6b5a48',
    skirt: i % 3 === 0,
    sock: '#ffffff',
    shoe: '#4a3a3a',
    hair: HAIRS[i % HAIRS.length],
    cut: CUTS[i % CUTS.length]
  };
}
