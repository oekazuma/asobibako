import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BREEDS } from './breeds';
import { accessory, hit } from './accessories';
import { furMaterial } from './fur';
import { LOOKS, type Look, type Part } from './looks';
import { KEYS, jumpArc, pounceArc, reopen, target, type Pose } from './pose';
import { bounds, field, mesh as surface, type Field, type Shape, type Surface, type V3 } from './sculpt';
import type { Quality } from '$lib/graphics.svelte';
import type { AccessoryId, BreedId, PetAction } from './types';

/**
 * 犬と猫の 3D。胴・首・頭・耳・足・しっぽをなめらかにつないだ 1 枚の面を骨で曲げ（SkinnedMesh）、
 * 同じ面を少しずつふくらませた殻を重ねて毛にする（fur.ts）。目・鼻・下あごは頭の骨に付けた別の形。
 * 形は肩の高さを 1 とした単位で作り、root を肩の高さ（m）倍する。group の原点が足元の中心で、+z を向く
 */

export interface PetModel {
  group: THREE.Group;
  mouth: THREE.Object3D;
  update(action: PetAction, dt: number, o: { speed: number; wag: number; look: number; t: number }): void;
  setAccessory(id: AccessoryId | null): void;
  /** 汚れ具合 0..1。毛がくすみ、足元・胸・顔に泥はねが出る */
  setDirt(v: number): void;
  /** ぬれ具合 0..1。毛が寝て短くなり、色が少し暗く、つやが出る */
  setWet(v: number): void;
  /** 体に付いた泡。FOAM_SPOTS 個のかたまりごとの量 0..1（背中・横腹・胸・腰・首・頭の順） */
  setFoam(levels: ArrayLike<number>): void;
  /** i 番目の泡のかたまりの、世界の座標での位置（最後に描いたときのかっこう） */
  foamAt(i: number, out: THREE.Vector3): THREE.Vector3;
  /** 画質を変える。形を作り直して group の中身を入れ替え、かっこう・アクセサリー・汚れ・ぬれ・泡は引き継ぐ */
  setQuality(q: Quality): void;
  dispose(): void;
}

/**
 * 画質ごとの毛と面。layers は種類ごとの殻の枚数に掛ける倍率（low は 2 枚に固定）、len は毛の長さ、
 * cell は毛 1 本の間隔、h は面の格子の細かさ、shell は殻に使う粗い面の格子（体の格子に対する倍率）
 */
const QUALITY: Record<Quality, { layers: number; len: number; cell: number; h: number; shell: number }> = {
  high: { layers: 1.6, len: 1.12, cell: 0.85, h: 1, shell: 1.25 },
  normal: { layers: 1, len: 1, cell: 1, h: 1, shell: 1.5 },
  low: { layers: 0, len: 0.55, cell: 1.3, h: 1.3, shell: 2 }
};
const layersOf = (look: Look, q: Quality) => (q === 'low' ? 2 : Math.round(look.fur.layers * QUALITY[q].layers));

// geometry と material は全部のペットで共有し、dispose では消さない。
// 3 匹を入れ替えても種類ごとの形は同じなので、作り直すより持ち続けるほうが軽い
const materials = new Map<string, THREE.Material>();
function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    materials.set(key, m);
  }
  return m;
}
const geometries = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);
const mirror = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---- 形を面にする ----

interface Body {
  geo: THREE.BufferGeometry;
  /** 殻に使う粗い面 */
  shell: THREE.BufferGeometry;
  bones: string[];
  /** 左目・右目の中心と見る向き */
  eyes: { at: THREE.Vector3; surf: THREE.Vector3; gaze: THREE.Vector3 }[];
  nose: THREE.Vector3;
  foam: FoamSpot[];
  omega?: THREE.Vector3[][];
  /** 削る形を除いた体の形。アクセサリーを体の面に合わせるのに使う */
  plain: Field;
}

interface FoamSpot {
  bone: string;
  /** かたまりの泡の中心と半径（形の座標） */
  bubbles: { at: THREE.Vector3; r: number }[];
}
const bodies = new Map<string, Body>();
/** 形を面にしたもの。画質で毛の長さだけが違うときは同じ面を使い回す（面にするのがいちばん重い） */
const surfaces = new Map<string, Surface>();

// ---- 形の控え ----

/**
 * 面にして色と骨の重さを付けた体の形は 1 種類で 1 秒ほどかかる（ふれあいひろばは 8 種類）。
 * IndexedDB に版ごとに控え、次に開いたときは読むだけにする。読むのは非同期なので、ペットを作る前に loadShapes で読む
 */
const ATTRS = { position: 3, normal: 3, color: 3, furLen: 1, furComb: 3, skinIndex: 4, skinWeight: 4 } as const;
type Saved = Record<keyof typeof ATTRS | 'index', Float32Array | Uint16Array | Uint32Array>;
const saved = new Map<string, { geo: Saved; shell: Saved }>();
const STORE = 'shapes';
const shapesVersion = __PET_SHAPES__;
let opened: Promise<IDBDatabase | null> | undefined;

function shapeDb() {
  opened ??= new Promise((ok) => {
    try {
      const req = indexedDB.open('asobibako-pet-house', 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => ok(req.result);
      req.onerror = req.onblocked = () => ok(null);
    } catch {
      // 使えない所（プライベートブラウズ・テスト）では毎回作る
      ok(null);
    }
  });
  // 開けなかったときは覚え続けず、次に開いたとき試しなおす
  void opened.then((db) => {
    if (!db) opened = undefined;
  });
  return opened;
}

/** 控えてある形を読みこむ。前の版の控えはここで捨てる */
export async function loadShapes(ids: readonly BreedId[], q: Quality): Promise<void> {
  const db = await shapeDb();
  if (!db) return;
  await new Promise<void>((ok) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      const keys = st.getAllKeys();
      keys.onsuccess = () => {
        for (const k of keys.result) if (!String(k).startsWith(`${shapesVersion}:`)) st.delete(k);
      };
      for (const id of ids) {
        const key = `${id}:${q}`;
        if (bodies.has(key)) continue;
        const r = st.get(`${shapesVersion}:${key}`);
        r.onsuccess = () => r.result && saved.set(key, r.result);
      }
      tx.oncomplete = tx.onerror = tx.onabort = () => ok();
    } catch {
      ok();
    }
  });
}

function toSaved(g: THREE.BufferGeometry): Saved {
  const out = { index: g.index!.array } as Saved;
  for (const name of Object.keys(ATTRS) as (keyof typeof ATTRS)[])
    out[name] = g.attributes[name].array as Saved[typeof name];
  return out;
}

function fromSaved(a: Saved) {
  const g = new THREE.BufferGeometry();
  for (const [name, size] of Object.entries(ATTRS))
    g.setAttribute(name, new THREE.BufferAttribute(a[name as keyof typeof ATTRS], size));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  return g;
}

function keepShapes(key: string, geo: THREE.BufferGeometry, shell: THREE.BufferGeometry) {
  void shapeDb().then((db) => {
    try {
      db?.transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .put({ geo: toSaved(geo), shell: toSaved(shell) }, `${shapesVersion}:${key}`);
    } catch {
      // 容量が足りないときは控えないだけ
    }
  });
}

/** 形の頂点ごとの色・毛・骨の重さを付けた BufferGeometry にする */
function dress(
  look: Look,
  shapes: Part[],
  s: { pos: Float32Array; nrm: Float32Array; idx: Uint32Array },
  f: Field,
  bones: string[],
  avoid: { v: THREE.Vector3; w: number }[],
  furScale = 1
) {
  const n = s.pos.length / 3;
  const colors = new Float32Array(n * 3);
  const furLen = new Float32Array(n);
  const comb = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const d = new Float64Array(f.count);
  const perBone = new Float64Array(bones.length);
  const boneOf = shapes.map((sh) => bones.indexOf(sh.bone));
  const c = new THREE.Color();
  const acc = new THREE.Color();
  const cv = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const rim = new THREE.Color(look.eye.rim);
  const h = look.h;
  for (let v = 0; v < n; v++) {
    const p: V3 = [s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2]];
    const nn: V3 = [s.nrm[v * 3], s.nrm[v * 3 + 1], s.nrm[v * 3 + 2]];
    f.each(p[0], p[1], p[2], d);
    let dmin = Infinity;
    shapes.forEach((sh, i) => {
      if (!sh.cut) dmin = Math.min(dmin, d[i]);
    });
    perBone.fill(0);
    acc.setRGB(0, 0, 0);
    cv.set(0, 0, 0);
    let fur = 0;
    let wsum = 0;
    // 削った面（目のくぼみ・耳の内側）の上なら、その形の色と毛にする
    const onCut = shapes.findIndex((sh, i) => sh.cut && Math.abs(d[i]) < h * 0.9);
    shapes.forEach((sh, i) => {
      if (sh.cut) return;
      const w = Math.max(0, 1 - (d[i] - dmin) / Math.max(sh.k, 0.02)) ** 2;
      if (w <= 0) return;
      perBone[boneOf[i]] += w;
      const tag = onCut >= 0 ? shapes[onCut].tag : sh.tag;
      c.set(tag === 'socket' ? look.eye.rim : look.paint(p, nn, tag));
      // くちびるの下の端を黒く縁どって口の線にする
      if (tag === 'lip' && look.lip !== undefined) c.lerp(rim, smooth(look.lip + 0.024, look.lip + 0.006, p[1]));
      acc.add(c.multiplyScalar(w));
      fur += w * (onCut >= 0 && tag === 'socket' ? 0 : look.furLen(p, nn, tag));
      if (sh.comb) cv.addScaledVector(v3(sh.comb).normalize(), w);
      else if (sh.cone) cv.addScaledVector(v3(sh.cone.b).sub(v3(sh.a)).normalize(), w);
      else cv.addScaledVector(new THREE.Vector3(0, -0.3, -1).normalize(), w);
      wsum += w;
    });
    acc.multiplyScalar(1 / wsum);
    colors.set([acc.r, acc.g, acc.b], v * 3);
    // 目と鼻のまわりは毛で埋めない
    let near = 1;
    // 猫は目のきわまで毛をかぶせ、目玉が顔から浮いて見えないようにする
    const [n0, n1] = look.kind === 'cat' ? [0.92, 1.5] : [1.05, 2.1];
    for (const a of avoid) near = Math.min(near, smooth(a.w * n0, a.w * n1, a.v.distanceTo(tmpP.set(...p))));
    furLen[v] = (fur / wsum) * near * look.fur.len * furScale;
    cv.multiplyScalar(1 / wsum).normalize();
    comb.set([cv.x * 0.8, cv.y * 0.8 - 0.25, cv.z * 0.8], v * 3);
    const top = [...perBone.keys()].sort((a, b) => perBone[b] - perBone[a]).slice(0, 4);
    const tw = top.reduce((t, i) => t + perBone[i], 0);
    top.forEach((b, k) => {
      skinIndex[v * 4 + k] = b;
      skinWeight[v * 4 + k] = perBone[b] / tw;
    });
  }
  // 隣の頂点と色・毛の長さをならして、模様の境目をぼかす
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < s.idx.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = s.idx[t + e];
      const b = s.idx[t + ((e + 1) % 3)];
      nb[a].push(b);
      nb[b].push(a);
    }
  for (let it = 0; it < 2; it++) {
    const cc = colors.slice();
    const ff = furLen.slice();
    for (let v = 0; v < n; v++) {
      const list = nb[v];
      if (!list.length) continue;
      let r = cc[v * 3];
      let g = cc[v * 3 + 1];
      let b = cc[v * 3 + 2];
      let fl = ff[v];
      for (const u of list) {
        r += cc[u * 3];
        g += cc[u * 3 + 1];
        b += cc[u * 3 + 2];
        fl += ff[u];
      }
      const k = 1 / (list.length + 1);
      colors.set([r * k, g * k, b * k], v * 3);
      furLen[v] = Math.min(ff[v], fl * k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('furLen', new THREE.BufferAttribute(furLen, 1));
  g.setAttribute('furComb', new THREE.BufferAttribute(comb, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(s.idx, 1));
  return g;
}

/** 目の穴のふちから外へなだらかに、目の骨の重さを混ぜる。ふちは全部目の骨に付き、つぶすと暗いふちが線になる */
function weighEye(g: THREE.BufferGeometry, at: THREE.Vector3, r: number, bone: number) {
  const pos = g.attributes.position;
  const idx = g.attributes.skinIndex;
  const wt = g.attributes.skinWeight;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const w = smooth(r * 2.1, r * 1.15, v.fromBufferAttribute(pos, i).distanceTo(at));
    if (w <= 0) continue;
    const list = [0, 1, 2, 3].map((k) => ({ b: idx.getComponent(i, k), w: wt.getComponent(i, k) * (1 - w) }));
    list.sort((a, b) => a.w - b.w)[0] = { b: bone, w };
    list.forEach((e, k) => {
      idx.setComponent(i, k, e.b);
      wt.setComponent(i, k, e.w);
    });
  }
}

function bodyOf(id: BreedId, look: Look, q: Quality): Body {
  const cached = bodies.get(`${id}:${q}`);
  if (cached) return cached;
  const Q = QUALITY[q];
  // 猫は目のまわりの毛を目の骨に付け、たてにつぶして目を閉じる（まぶたの円盤より毛並みになじむ）
  const bones = [...Object.keys(look.joints), ...(look.kind === 'cat' ? ['eye.l', 'eye.r'] : [])];
  const plain = field(look.shapes.filter((s) => !s.cut));
  const r = look.eye.r;
  // 目玉は面より奥に置き、手前に切った目の形（横長）の穴からのぞかせる。穴のふちが目のきわの黒になる
  const eyes = [1, -1].map((s) => {
    const gaze = v3(mirror(look.eye.gaze, s)).normalize();
    const surf = hit(plain, v3(mirror(look.eye.at, s)).addScaledVector(gaze, -0.12), gaze);
    return { at: surf.clone().addScaledVector(gaze, -r * (look.kind === 'cat' ? 0.8 : 0.72)), surf, gaze };
  });
  const noseDir = v3(look.nose.dir).normalize();
  const nose = hit(plain, v3(look.nose.at).addScaledVector(noseDir, -0.1), noseDir);
  const sockets: Part[] = eyes.map((e, i) => {
    const yaw = Math.asin(e.gaze.x);
    return {
      a: e.surf
        .clone()
        .addScaledVector(e.gaze, r * 0.2)
        .toArray() as V3,
      // 猫は目じりを上げない丸い穴にする（つり目はにらんで見える）
      ell: [r * 1.0, r * (look.kind === 'cat' ? 0.66 : 0.66), r * 0.75],
      turn: [-Math.asin(e.gaze.y / Math.cos(yaw)), yaw, (i === 0 ? 1 : -1) * (look.kind === 'cat' ? 0 : 0.18)],
      k: r * 0.25,
      cut: true,
      bone: 'head',
      tag: 'socket'
    };
  });
  const shapes = [...look.shapes, ...sockets];
  const f = field(shapes, look.detail);
  const box = bounds(shapes, look.h * 3 + 0.04);
  const avoid = [...eyes.map((e) => ({ v: e.surf, w: r })), { v: nose, w: look.nose.r[0] * 1.1 }];
  const surf = (h: number) => {
    const key = `${id}:${h}`;
    let m = surfaces.get(key);
    if (!m) surfaces.set(key, (m = surface(f, box, look.h * h, look.detail?.amp)));
    return m;
  };
  const key = `${id}:${q}`;
  const stored = saved.get(key);
  saved.delete(key);
  const g = stored ? fromSaved(stored.geo) : dress(look, shapes, surf(Q.h), f, bones, avoid, Q.len);
  // 殻は毛先がぼやけるので、粗い面で足りる。三角形の数が殻の枚数倍になるのを抑える
  const coarse = stored ? fromSaved(stored.shell) : dress(look, shapes, surf(Q.h * Q.shell), f, bones, avoid, Q.len);
  // 口の線は頂点の色では細く描けないので、顔の面に沿わせた細い管にする
  const omega = look.omega?.map((line) =>
    line.map((p) => hit(plain, v3(p).add(new THREE.Vector3(0, 0, -0.08)), new THREE.Vector3(0, 0.15, 1).normalize()))
  );
  if (look.kind === 'cat' && !stored)
    for (const geom of [g, coarse])
      eyes.forEach((e, i) => weighEye(geom, e.surf, r, bones.indexOf(i ? 'eye.r' : 'eye.l')));
  if (!stored) keepShapes(key, g, coarse);
  const body = { geo: g, shell: coarse, bones, eyes, nose, foam: foamSpots(look, plain), omega, plain };
  bodies.set(`${id}:${q}`, body);
  return body;
}

/** 泡のかたまりを置く所。骨、骨の位置からずらした体の中の点、面へ出る向き */
const FOAM: [string, V3, V3][] = [
  ['chest', [0, 0, 0.15], [0, 1, 0.2]],
  ['chest', [0, 0, -0.05], [0, 1, 0]],
  ['chest', [0, 0, 0.12], [1, 0.4, 0.2]],
  ['chest', [0, 0, 0.12], [-1, 0.4, 0.2]],
  ['chest', [0, 0, 0.1], [1, 0.02, 0.1]],
  ['chest', [0, 0, 0.1], [-1, 0.02, 0.1]],
  ['chest', [0, 0, 0.08], [1, -0.35, 0]],
  ['chest', [0, 0, 0.08], [-1, -0.35, 0]],
  ['chest', [0, -0.05, 0.2], [0, -0.3, 1]],
  ['hips', [0, 0, 0], [0, 1, 0]],
  ['hips', [0, 0, -0.12], [0, 1, -0.3]],
  ['hips', [0, 0, 0], [1, 0.4, 0]],
  ['hips', [0, 0, 0], [-1, 0.4, 0]],
  ['hips', [0, 0, -0.03], [1, 0.02, -0.05]],
  ['hips', [0, 0, -0.03], [-1, 0.02, -0.05]],
  ['hips', [0, 0, -0.05], [1, -0.35, -0.1]],
  ['hips', [0, 0, -0.05], [-1, -0.35, -0.1]],
  ['hips', [0, 0, -0.1], [0, 0.1, -1]],
  ['neck', [0, 0, 0], [0, 1, -0.3]],
  ['head', [0, 0.02, 0], [0, 1, -0.3]],
  ['head', [0, 0.02, 0], [1, 0.5, -0.2]],
  ['head', [0, 0.02, 0], [-1, 0.5, -0.2]]
];
export const FOAM_SPOTS = FOAM.length;
const BUBBLES = 14;

/** かたまりごとに、大きな泡 1 つのまわりへ小さな泡を面に沿って散らし、毛先の上に乗せる */
function foamSpots(look: Look, f: Field): FoamSpot[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const t1 = new THREE.Vector3();
  const t2 = new THREE.Vector3();
  return FOAM.map(([bone, off, dir]) => {
    const dv = v3(dir).normalize();
    const at = hit(f, v3(look.joints[bone]).add(v3(off)), dv);
    t1.set(0, 1, 0).cross(dv);
    if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
    t1.normalize();
    t2.copy(dv).cross(t1);
    const bubbles = Array.from({ length: BUBBLES }, (_, k) => {
      const r = k ? 0.024 + rnd() * 0.034 : 0.065;
      const a = rnd() * Math.PI * 2;
      const d = k ? 0.03 + rnd() * 0.085 : 0;
      const p = at
        .clone()
        .addScaledVector(t1, Math.cos(a) * d)
        .addScaledVector(t2, Math.sin(a) * d)
        .addScaledVector(dv, look.fur.len * 0.8 + r * 0.45);
      return { at: p, r };
    });
    return { bone, bubbles };
  });
}

/** 頭に付ける小さな形（鼻・下あご）。色は paint から、毛は短くして殻は重ねない */
function small(look: Look, key: string, shapes: Part[], h: number, len: number) {
  return geo(key, () => {
    const f = field(shapes);
    const s = surface(f, bounds(shapes, h * 3), h);
    return dress(look, shapes, s, f, [shapes[0].bone], [], len);
  });
}

function noseGeo(id: BreedId, look: Look, at: THREE.Vector3) {
  return geo(`nose:${id}`, () => {
    const [rx, ry, rz] = look.nose.r;
    const c = at.clone().addScaledVector(v3(look.nose.dir).normalize(), -rz * 0.3);
    const o = (x: number, y: number, z: number): V3 => [c.x + x, c.y + y, c.z + z];
    const shapes: Shape[] = look.nose.cat
      ? [
          { a: o(0, ry * 0.2, 0), ell: [rx, ry * 0.8, rz], k: 0, bone: 'head', tag: 'nose' },
          {
            a: o(0, ry * 0.2, 0),
            cone: { b: o(0, -ry * 0.9, rz * 0.3), ra: rx * 0.7, rb: rx * 0.25 },
            k: ry * 0.6,
            bone: 'head',
            tag: 'nose'
          }
        ]
      : [
          { a: c.toArray() as V3, ell: [rx, ry, rz], k: 0, bone: 'head', tag: 'nose' },
          { a: o(0, ry * 0.25, -rz * 0.2), ell: [rx * 0.8, ry * 0.9, rz], k: ry * 0.5, bone: 'head', tag: 'nose' },
          ...[1, -1].map((s): Shape => ({
            // 浅く切る。深いと鼻の裏まで抜け、後ろの白い鼻先が穴から見える
            a: o(s * rx * 0.42, -ry * 0.12, rz * 0.95),
            ell: [rx * 0.22, ry * 0.3, rz * 0.3],
            turn: [0, 0, s * 0.5],
            k: ry * 0.15,
            cut: true,
            bone: 'head',
            tag: 'nose'
          })),
          {
            a: o(0, -ry * 0.85, rz * 0.8),
            ell: [rx * 0.07, ry * 0.45, rz * 0.4],
            k: ry * 0.1,
            cut: true,
            bone: 'head',
            tag: 'nose'
          }
        ];
    const f = field(shapes);
    const s = surface(f, bounds(shapes, ry * 0.5), ry * 0.14);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3));
    g.setIndex(new THREE.BufferAttribute(s.idx, 1));
    return g;
  });
}

/** 足の裏の大きな肉球 1 つと、指の肉球 4 つ。足先の楕円体の下の面に少し埋める */
function padGeo(key: string, at: V3, r: V3) {
  return geo(key, () => {
    const [x, y, z] = at;
    const [rx, ry, rz] = r;
    const parts: THREE.BufferGeometry[] = [];
    const blob = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) =>
      parts.push(new THREE.SphereGeometry(1, 14, 10).scale(sx, sy, sz).translate(cx, cy, cz));
    // 足の裏から少しだけ盛り上がるよう、足先の面のすぐ内側に中心を置く
    blob(x, y - ry * 0.8, z - rz * 0.12, rx * 0.56, ry * 0.3, rz * 0.46);
    for (const o of [-0.62, -0.22, 0.22, 0.62])
      blob(
        x + rx * o,
        y - ry * (0.66 - 0.16 * Math.abs(o)),
        z + rz * (0.52 + 0.16 * (1 - Math.abs(o))),
        rx * 0.22,
        ry * 0.26,
        rz * 0.2
      );
    return mergeGeometries(parts);
  });
}

/** 目玉。前に瞳、まわりに虹彩を頂点の色で描く。左右をまとめて 1 つの形にする */
function eyeGeo(id: BreedId, look: Look, eyes: Body['eyes'], head: THREE.Vector3) {
  return geo(`eye:${id}`, () => {
    const e = look.eye;
    const parts = eyes.map((eye) => {
      const s = new THREE.SphereGeometry(e.r, 72, 56);
      const pos = s.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const [iris, rim, pupil] = [new THREE.Color(e.iris), new THREE.Color(e.rim), new THREE.Color('#0a0808')];
      const edge = iris.clone().multiplyScalar(0.55);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        // 球の +z が前（見る向き）
        const x = pos.getX(i) / e.r;
        const y = pos.getY(i) / e.r;
        const z = pos.getZ(i) / e.r;
        const cat = e.pupil === 'cat';
        // 穴からのぞくのは前の 4 割ほど。そこを虹彩で埋め、真ん中に瞳。
        // 猫は瞳を大きく丸くして虹彩を細い輪にする（瞳が細いと驚いてにらんだ顔に見える）
        const pr = cat ? Math.hypot(x / 0.44, y / 0.5) : Math.hypot(x, y) / 0.48;
        const ir = Math.hypot(x, y);
        if (z > 0 && pr < 1) c.copy(pupil);
        else if (z > 0 && ir < (cat ? 0.97 : 0.85))
          // 虹彩は上を暗く下を明るくして、ぬれた目の奥行きに見せる
          c.copy(iris)
            .multiplyScalar(cat ? 0.8 + 0.3 * smooth(0.3, -0.6, y) : 0.55 + 0.6 * smooth(0.3, -0.6, y))
            .lerp(edge, cat ? smooth(0.7, 0.95, ir) : smooth(0.55, 0.82, ir));
        else c.copy(rim);
        col.set([c.r, c.g, c.b], i * 3);
      }
      s.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // 前後に少しつぶし、閉じたまぶたが顔から盛り上がらないようにする
      s.scale(1, 1, EYE_DEPTH);
      s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eye.gaze));
      s.translate(eye.at.x - head.x, eye.at.y - head.y, eye.at.z - head.z);
      return s;
    });
    return mergeGeometries(parts);
  });
}

const EYE_DEPTH = 0.8;

// ---- 骨組み ----

interface Leg {
  bones: THREE.Bone[];
  rest: THREE.Vector3[];
  front: boolean;
  side: number;
  /** 上の 2 本の長さ */
  a: number;
  b: number;
  dirs: THREE.Vector3[];
  foot: THREE.Vector3;
}

interface Rig {
  root: THREE.Group;
  bone: Map<string, THREE.Bone>;
  legs: Leg[];
  lids: { upper: THREE.Object3D; lower: THREE.Object3D }[];
  /** 閉じた目の線（左右）。y を縮めると丸い弧が横線になる */
  lashes: THREE.Object3D[];
  /** 目玉とその光。閉じたときは隠し、まぶたを穴の奥に収める */
  eyeParts: THREE.Object3D[];
  inner: THREE.Object3D[];
  tongue: THREE.Object3D;
  tongueAt: THREE.Vector3;
  mouth: THREE.Object3D;
  headAnchor: THREE.Object3D;
  skeleton: THREE.Skeleton;
  body: Body;
  /** 毛の material を持つ形と、その殻の番号。ぬれたら material を差し替える */
  fur: { mesh: THREE.Mesh; layer: number }[];
  layers: number;
  cell: number;
  /** 骨ごとの泡の形と、泡のかたまりがどの形の何番目からかを数えた表 */
  foam: { mesh: THREE.InstancedMesh; spots: number[] }[];
  foamSpots: FoamSpot[];
  foamBase: THREE.Object3D[];
  /** 汚れがいちばんひどいときに体のまわりを跳ねるノミ。root の座標で置く */
  fleas: THREE.InstancedMesh;
}

/**
 * 骨で曲げたメッシュは、外接を聞かれるたびに全頂点を骨で動かして測り直す（ひろばの 8 匹で 0.5 秒止まった）。
 * 影の大きさと描く順番の目安にしか使わないので、立ち姿の形の外接で足りる
 */
export function restBounds(m: THREE.SkinnedMesh): void {
  const g = m.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingSphere) g.computeBoundingSphere();
  m.boundingBox = g.boundingBox!.clone();
  m.boundingSphere = g.boundingSphere!.clone();
}

function build(look: Look, id: BreedId, q: Quality): Rig {
  const body = bodyOf(id, look, q);
  const Q = QUALITY[q];
  const cell = look.fur.cell * Q.cell;
  const root = new THREE.Group();
  const bone = new Map<string, THREE.Bone>();
  for (const name of body.bones) {
    const b = new THREE.Bone();
    b.name = name;
    bone.set(name, b);
  }
  for (const name of body.bones) {
    const b = bone.get(name)!;
    const eye = name === 'eye.l' ? body.eyes[0] : name === 'eye.r' ? body.eyes[1] : null;
    const at = eye ? (eye.surf.toArray() as V3) : look.joints[name];
    const parent = eye ? 'head' : look.parents[name];
    if (parent) {
      const pa = look.joints[parent];
      b.position.set(at[0] - pa[0], at[1] - pa[1], at[2] - pa[2]);
      bone.get(parent)!.add(b);
    } else {
      b.position.set(...at);
      root.add(b);
    }
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(body.bones.map((n) => bone.get(n)!));
  const L = layersOf(look, q);
  const fur: Rig['fur'] = [];
  for (let i = 0; i <= L; i++) {
    const m = new THREE.SkinnedMesh(i ? body.shell : body.geo, furMaterial(i, L, cell));
    fur.push({ mesh: m, layer: i });
    m.bind(skeleton, new THREE.Matrix4());
    restBounds(m);
    // 骨で曲げた形は元の外接球からはみ出すので、画面の端で消えないよう切り捨てない
    m.frustumCulled = false;
    m.castShadow = i === 0;
    m.receiveShadow = true;
    root.add(m);
  }

  // 頭と下あごに付ける形は、形を作った座標のまま置けるよう骨の位置だけ戻した入れ物に入れる
  const space = (name: string) => {
    const g = new THREE.Group();
    const at = look.joints[name];
    g.position.set(-at[0], -at[1], -at[2]);
    bone.get(name)!.add(g);
    return g;
  };
  const headSpace = space('head');
  const jawSpace = space('jaw');
  const headAt = v3(look.joints.head);
  const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = shadow;
    parent.add(o);
    return o;
  };

  const eyeBall = add(
    bone.get('head')!,
    eyeGeo(id, look, body.eyes, headAt),
    // つやを抑え、部屋の映り込みも弱める（つるつるだとガラス玉に見える）
    mat('#ffffff', { vertexColors: true, roughness: 0.5, envMapIntensity: 0.3 }),
    false
  );
  eyeBall.name = 'eyes';
  const lids: Rig['lids'] = [];
  const eyeParts: THREE.Object3D[] = [eyeBall];
  const r = look.eye.r;
  const cat = look.kind === 'cat';
  const lidMat = mat('#ffffff', { roughness: 0.9, vertexColors: true });
  // まぶたのふちを暗くして、閉じた目が線に見えるようにする
  const lid = (upper: boolean) =>
    geo(`lid:${upper ? 'u' : 'l'}:${r}:${look.eye.lid}:${look.eye.rim}`, () => {
      const g = new THREE.SphereGeometry(r, 36, 24, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const [fur, edge, c] = [new THREE.Color(look.eye.lid), new THREE.Color(look.eye.rim), new THREE.Color()];
      for (let i = 0; i < pos.count; i++) {
        c.copy(fur).lerp(edge, 0.1 + 0.9 * smooth(0.3, 0.06, Math.abs(pos.getY(i)) / r));
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
  const upperGeo = lid(true);
  const lowerGeo = lid(false);
  const shineMat = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.3 });
  // 光は左右の目の 2 つずつを 1 つの形にまとめる（描く回数を減らす）
  const shineGeo = geo(`shine:${id}`, () => {
    const er = look.eye.r;
    const m = new THREE.Matrix4();
    const parts = body.eyes.flatMap((eye, i) => {
      m.compose(
        eye.at,
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eye.gaze),
        new THREE.Vector3(1, 1, EYE_DEPTH)
      );
      // 光を 2 つ入れて、うるんだ目にする。上まぶたに隠れない高さに置く
      return [
        new THREE.SphereGeometry(er * 0.13, 12, 8).translate(er * (i === 0 ? 0.26 : 0.14), er * 0.2, er * 0.95),
        new THREE.SphereGeometry(er * 0.06, 8, 6).translate(-er * (i === 0 ? 0.2 : 0.28), -er * 0.26, er * 0.95)
      ].map((g) => g.applyMatrix4(m));
    });
    return mergeGeometries(parts);
  });
  eyeParts.push(add(headSpace, shineGeo, shineMat, false));
  // 閉じた目は、まぶたの面だけだと小さく見て閉じたのがわからない（黒猫は面が毛にとけて消える）。
  // 目の前に下へ丸い弧の線を浮かせて描く。黒い毛の上では暗い線が見えないので明るくする
  const coat = new THREE.Color(look.eye.lid);
  const lashMat = mat(coat.r * 0.3 + coat.g * 0.6 + coat.b * 0.1 < 0.1 ? '#e8dcc6' : '#3a2419', { roughness: 1 });
  const lashGeo = geo(`lash:${r}`, () => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const x = (i / 8) * 2 - 1;
      return new THREE.Vector3(x * r * 1.05, r * 0.42 * (x * x - 1) + r * 0.1, 0);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r * 0.13, 6);
  });
  const lashes: THREE.Object3D[] = [];
  for (const eye of body.eyes) {
    const gazeQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eye.gaze);
    const lash = add(headSpace, lashGeo, lashMat, false);
    lash.position.copy(eye.surf).addScaledVector(eye.gaze, r * 0.2);
    lash.quaternion.copy(gazeQ);
    lash.name = 'lash';
    lash.visible = false;
    lashes.push(lash);
    if (cat) continue;
    const lidSpace = new THREE.Group();
    lidSpace.position.copy(eye.surf).addScaledVector(eye.gaze, -look.eye.r * 0.35);
    lidSpace.quaternion.copy(gazeQ);
    lidSpace.scale.set(1.08, 1.0, 0.3);
    headSpace.add(lidSpace);
    const upper = add(lidSpace, upperGeo, lidMat, false);
    const lower = add(lidSpace, lowerGeo, lidMat, false);
    lids.push({ upper, lower });
  }
  add(headSpace, noseGeo(id, look, body.nose), mat(look.nose.color, { roughness: look.nose.cat ? 0.6 : 0.7 }));
  if (body.omega) {
    const lines = body.omega;
    const g = geo(`omega:${id}`, () =>
      mergeGeometries(lines.map((l) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l), 20, 0.0032, 5)))
    );
    add(headSpace, g, mat(look.eye.rim, { roughness: 0.8 }), false);
  }
  // 下あごも顔なので殻は重ねない
  const chin = add(jawSpace, small(look, `chin:${id}:${q}`, look.chin, look.h * 0.6, Q.len), furMaterial(0, L, cell));
  fur.push({ mesh: chin, layer: 0 });

  const innerMesh = add(
    headSpace,
    geo('sphere:1', () => new THREE.SphereGeometry(1, 16, 12)),
    mat('#5a2026', { roughness: 0.6 }),
    false
  );
  innerMesh.position.set(...look.inner.at);
  innerMesh.scale.set(...look.inner.r);
  const tongue = add(
    jawSpace,
    geo('sphere:1', () => new THREE.SphereGeometry(1, 16, 12)),
    mat('#f07c8c', { roughness: 0.45 }),
    false
  );
  tongue.position.set(...look.tongue.at);
  tongue.scale.set(...look.tongue.r);

  if (look.whiskers) {
    const w = look.whiskers;
    const pts: number[] = [];
    for (const s of [1, -1])
      for (let k = 0; k < 4; k++) {
        const a = v3(mirror(w.at, s));
        // 下向きに垂らすと、あごの下に結んだリボンの羽を突き抜ける。ほぼ水平に広げて先だけ少し下げる
        const dir = new THREE.Vector3(s, 0.16 - k * 0.07, 0.45 - k * 0.08).normalize();
        const mid = a.clone().addScaledVector(dir, w.len * 0.5);
        const end = a
          .clone()
          .addScaledVector(dir, w.len)
          .add(new THREE.Vector3(0, -w.len * 0.05, -w.len * 0.1));
        pts.push(...a.toArray(), ...mid.toArray(), ...mid.toArray(), ...end.toArray());
      }
    const lines = new THREE.LineSegments(
      geo(`whisker:${id}`, () =>
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      ),
      materials.get('whisker') ??
        materials
          .set('whisker', new THREE.LineBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.5 }))
          .get('whisker')!
    );
    headSpace.add(lines);
  }

  const mouth = new THREE.Object3D();
  mouth.position.set(...look.mouth);
  // world3d はおもちゃを m 単位で mouth に付けるので、root の拡大を打ち消す
  mouth.scale.setScalar(1 / look.S);
  headSpace.add(mouth);

  // 肉球。足先の骨に付け、前足を上げて足の裏を前へ向けると見える
  const padMat = mat(look.pads.color, { roughness: 0.85 });
  for (const leg of ['fl', 'fr', 'bl', 'br']) {
    const pad = look.pads[leg[0] === 'f' ? 'front' : 'hind'];
    const sx = leg[1] === 'l' ? 1 : -1;
    const g = space(`${leg}.3`);
    add(g, padGeo(`pads:${id}:${leg[0]}:${sx}`, mirror(pad.at, sx), pad.r), padMat, false);
  }
  const headAnchor = new THREE.Group();
  headSpace.add(headAnchor);

  // 泡は骨ごとに 1 つの InstancedMesh にまとめ、かたまりの量は泡 1 つずつの大きさで表す
  const foamMat = mat('#fbfcff', { roughness: 0.3, emissive: '#dfe6ee', emissiveIntensity: 0.25 });
  const foamGeo = geo('sphere:foam', () => new THREE.SphereGeometry(1, 12, 8));
  const foam: Rig['foam'] = [];
  const foamBase: THREE.Object3D[] = [];
  const byBone = new Map<string, Rig['foam'][number]>();
  body.foam.forEach((spot, i) => {
    let entry = byBone.get(spot.bone);
    if (!entry) {
      const g = space(spot.bone);
      const m = new THREE.InstancedMesh(
        foamGeo,
        foamMat,
        body.foam.filter((f) => f.bone === spot.bone).length * BUBBLES
      );
      m.name = 'foam';
      m.visible = false;
      // 骨で動く入れ物の中なので、元の位置の外接球で切ると体を回したときに消える
      m.frustumCulled = false;
      g.add(m);
      entry = { mesh: m, spots: [] };
      byBone.set(spot.bone, entry);
      foam.push(entry);
    }
    entry.spots.push(i);
    foamBase[i] = entry.mesh.parent!;
  });

  const legs: Leg[] = (['fl', 'fr', 'bl', 'br'] as const).map((name) => {
    const bones = [0, 1, 2, 3].map((i) => bone.get(`${name}.${i}`)!);
    const rest = [0, 1, 2, 3].map((i) => v3(look.joints[`${name}.${i}`]));
    return {
      bones,
      rest,
      front: name[0] === 'f',
      side: name[1] === 'l' ? 1 : -1,
      a: rest[0].distanceTo(rest[1]),
      b: rest[1].distanceTo(rest[2]),
      dirs: [0, 1, 2].map((i) => rest[i + 1].clone().sub(rest[i]).normalize()),
      foot: rest[3].clone().sub(rest[2])
    };
  });

  return {
    root,
    bone,
    legs,
    lids,
    lashes,
    eyeParts,
    inner: [innerMesh, tongue],
    tongue,
    tongueAt: tongue.position.clone(),
    mouth,
    headAnchor,
    skeleton,
    body,
    fur,
    layers: L,
    cell,
    foam,
    foamSpots: body.foam,
    foamBase,
    fleas: fleaMesh(root)
  };
}

const FLEAS = 12;

function fleaMesh(root: THREE.Object3D) {
  const m = new THREE.InstancedMesh(
    geo('flea', () => new THREE.SphereGeometry(1, 8, 6)),
    mat('#2a1a10', { roughness: 0.3 }),
    FLEAS
  );
  m.name = 'fleas';
  m.visible = false;
  m.frustumCulled = false;
  root.add(m);
  return m;
}

/**
 * きれいがこれを下回ると汚れが最上段になり、ノミが出る（world3d は きれい 70→0 を汚れ 0→1 の 9 段にし、setDirt が 4 段に丸める）
 */
export const FLEA_CLEAN = 11.6;

// ---- 動き ----

const tmp = {
  q: new THREE.Quaternion(),
  q2: new THREE.Quaternion(),
  qa: new THREE.Quaternion(),
  qb: new THREE.Quaternion(),
  qc: new THREE.Quaternion(),
  e: new THREE.Euler(),
  s: new THREE.Vector3(),
  w: new THREE.Vector3(),
  el: new THREE.Vector3(),
  d: new THREE.Vector3(),
  pole: new THREE.Vector3(),
  perp: new THREE.Vector3(),
  foot: new THREE.Vector3(),
  v: new THREE.Vector3()
};

/**
 * 足先 paw（足先の関節の位置、root の座標）へ届くよう、上の 2 本を解いて曲げる。
 * 手首から先は footAng だけ前へ倒し、足先は床と平行（flex だけ下へ曲げる）
 */
function solveLeg(
  leg: Leg,
  parentPos: THREE.Vector3,
  parentQ: THREE.Quaternion,
  paw: THREE.Vector3,
  footAng: number,
  flex: number,
  splay: number
) {
  const { s, w, el, d, pole, perp, foot, q, qa, qb, qc } = tmp;
  s.copy(leg.bones[0].position).applyQuaternion(parentQ).add(parentPos);
  foot.copy(leg.foot).applyAxisAngle(new THREE.Vector3(1, 0, 0), -footAng);
  w.copy(paw).sub(foot);
  d.copy(w).sub(s);
  const len = Math.min(Math.max(d.length(), Math.abs(leg.a - leg.b) + 1e-3), (leg.a + leg.b) * 0.999);
  d.normalize();
  // 前足のひじは後ろへ、後ろ足のひざは前へ曲がる
  pole.set(leg.side * splay, 0, leg.front ? -1 : 1).applyQuaternion(parentQ);
  perp.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
  const cos = (leg.a * leg.a + len * len - leg.b * leg.b) / (2 * leg.a * len);
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  el.copy(d)
    .multiplyScalar(cos * leg.a)
    .addScaledVector(perp, sin * leg.a)
    .add(s);
  w.copy(d).multiplyScalar(len).add(s);
  qa.setFromUnitVectors(leg.dirs[0], tmp.v.copy(el).sub(s).normalize());
  qb.setFromUnitVectors(leg.dirs[1], tmp.v.copy(w).sub(el).normalize());
  qc.setFromUnitVectors(leg.dirs[2], tmp.v.copy(foot).normalize());
  leg.bones[0].quaternion.copy(q.copy(parentQ).invert().multiply(qa));
  leg.bones[1].quaternion.copy(q.copy(qa).invert().multiply(qb));
  leg.bones[2].quaternion.copy(q.copy(qb).invert().multiply(qc));
  tmp.q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), flex);
  leg.bones[3].quaternion.copy(q.copy(qc).invert().multiply(tmp.q2));
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
/** 足の短い子のおすわりで、胴を起こす角度のうち腰で起こす割合。残りは胸で起こす */
const REAR = 0.25;

/** (y, z) を x 軸まわりに前が上がる向きへ a だけ回す */
const up = (y: number, z: number, a: number) => [y * Math.cos(a) + z * Math.sin(a), z * Math.cos(a) - y * Math.sin(a)];

/**
 * 足の短い子のかっこう。腰を下げるかっこうは胴が低いぶん浅くし、おすわりのように胴を起こすかっこうは、
 * ふつうの足の子と同じ高さまで腰が下がるところで止める（それより起こすと腰が床に沈む）。
 * 足が短いと肩の高さはほとんど上げられないので、起こせる角度は小さい。胴全体で起こすと胴の長いダックスは
 * 伏せているように見えるため、腰では少しだけ起こし、残りは胸で起こして上半身を立てる（前足で立ち、お尻は床）。
 * reach はふつうの胴の長さの子の、腰から肩までの前後の長さ（胴の長いダックスもこれで測る）
 */
function shorten(p: Pose, low: number, sh: THREE.Vector3, chest: THREE.Vector3, reach: number) {
  const y = p.y;
  if (p.y < 0) p.y += low * Math.min(1, -p.y / 0.25);
  // 腰で pitch だけ起こすと、肩は y·cos + z·sin − y だけ上がる（肩の高さを保つかっこうでは、そのぶん腰が下がる）
  const lift = (z: number, a: number) => sh.y * Math.cos(a) + z * Math.sin(a) - sh.y;
  const solve = (want: number) =>
    Math.asin(THREE.MathUtils.clamp((want + sh.y) / Math.hypot(sh.y, sh.z), -1, 1)) - Math.atan2(sh.y, sh.z);
  const ref = lift(Math.min(sh.z, reach), p.pitch);
  if (p.level > 0 && p.pitch > 0) {
    const want = ref - low * p.level;
    const hips = Math.max(0, solve(want)) * REAR;
    // 腰で hips、胸で a だけ起こしたときの肩の上がり。a について増えるので二分法で want に合わせる
    const bent = (a: number) => {
      const [dy, dz] = up(sh.y - chest.y, sh.z - chest.z, a);
      return up(chest.y + dy, chest.z + dz, hips)[0] - sh.y;
    };
    let [lo, hi] = [0, 1.4];
    for (let i = 0; i < 20; i++) [lo, hi] = bent((lo + hi) / 2) < want ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
    // 首は胴を起こした分だけ下げてあるので、減らした分は戻して顔を前へ向ける。胸で起こした分は首を立てたまま頭だけ戻す（update）
    p.hp -= (p.pitch - hips) * 1.3;
    p.pitch = hips;
    p.spine -= lo;
  } else if (p.level <= 0 && p.pitch < 0) {
    // 前へ伏せるかっこう（おじぎ）は、胸がふつうの子と同じ高さで止まるまで傾きを減らす
    p.pitch = Math.min(0, solve(ref + low - (p.y - y)));
  }
}

// 足を出す順（1 周を 1 とした位相）。歩きは左後ろ → 左前 → 右後ろ → 右前、走りは後ろ 2 本と前 2 本で跳ねる
const WALK_PHASE = [0.25, 0.75, 0, 0.5];
const RUN_PHASE = [0.5, 0.6, 0, 0.1];

export function createPet(breed: BreedId, quality: Quality = 'normal'): PetModel {
  const look = LOOKS[breed];
  const kind = BREEDS[breed].kind;
  const group = new THREE.Group();
  const J = (n: string) => v3(look.joints[n]);
  const hipsRest = J('hips');
  const shoulder = J('fl.0').sub(hipsRest).setX(0);
  const chestAt = J('chest').sub(hipsRest).setX(0);
  const pivot = new THREE.Vector3(0, 0.34, -0.1);

  // 画質を変えるときは形を作り直して入れ替える。update が使う骨はここで差し替える
  let rig!: Rig;
  let acc = new Map<AccessoryId, THREE.Group>();
  let worn: AccessoryId | null = null;
  let fitKey = '';
  let dirty = 0;
  let wet = 0;
  const foam = new Float32Array(FOAM_SPOTS);
  let hips!: THREE.Bone;
  let chest!: THREE.Bone;
  let neck!: THREE.Bone;
  let head!: THREE.Bone;
  let jaw!: THREE.Bone;
  let ears: THREE.Bone[] = [];
  let tail: THREE.Bone[] = [];
  let eyeBones: THREE.Bone[] = [];
  function mount(q: Quality) {
    const prev = rig;
    rig = build(look, breed, q);
    rig.root.scale.setScalar(look.S);
    if (prev) {
      // 骨のかっこうを写してから入れ替え、1 フレームもとの姿勢に戻らないようにする
      rig.root.position.copy(prev.root.position);
      rig.root.quaternion.copy(prev.root.quaternion);
      for (const [name, b] of prev.bone) {
        const nb = rig.bone.get(name);
        if (!nb) continue;
        nb.position.copy(b.position);
        nb.quaternion.copy(b.quaternion);
        nb.scale.copy(b.scale);
      }
      prev.root.removeFromParent();
    }
    group.add(rig.root);
    fitKey = `${breed}:${q}`;
    acc = new Map();
    wear();
    coat();
    showFoam();
    const bone = (n: string) => rig.bone.get(n)!;
    [hips, chest, neck, head, jaw] = ['hips', 'chest', 'neck', 'head', 'jaw'].map(bone);
    ears = [bone('ear.l'), bone('ear.r')];
    tail = Array.from({ length: look.tail }, (_, i) => bone(`tail.${i}`));
    eyeBones = ['eye.l', 'eye.r'].flatMap((n) => rig.bone.get(n) ?? []);
  }
  // 着けたことのあるものだけ作る。首まわりを測るのは種類と画質ごとに 1 度
  function wear() {
    if (worn && !acc.has(worn)) {
      const { group: a, on } = accessory(worn, {
        look,
        key: fitKey,
        field: rig.body.plain,
        body: rig.body.shell,
        skeleton: rig.skeleton
      });
      (on === 'head' ? rig.headAnchor : rig.root).add(a);
      acc.set(worn, a);
    }
    for (const [k, a] of acc) a.visible = k === worn;
  }
  function coat() {
    for (const f of rig.fur) f.mesh.material = furMaterial(f.layer, rig.layers, rig.cell, wet, dirty);
  }
  const bubble = new THREE.Matrix4();
  const noTurn = new THREE.Quaternion();
  const size = new THREE.Vector3();
  function showFoam() {
    for (const { mesh, spots } of rig.foam) {
      let any = false;
      spots.forEach((i, n) => {
        const level = foam[i];
        any ||= level > 0.01;
        rig.foamSpots[i].bubbles.forEach((b, k) => {
          // 大きな泡から順にふくらみ、量が増えるほどまわりの小さな泡が増える
          const from = (k / BUBBLES) * 0.7;
          const r = b.r * smooth(from, from + 0.3, level);
          mesh.setMatrixAt(n * BUBBLES + k, bubble.compose(b.at, noTurn, size.setScalar(r)));
        });
      });
      mesh.visible = any;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  mount(quality);

  // ノミは泡のかたまりの場所（体の面の上）にとまり、しばらくすると近くのかたまりか同じ所へ弧を描いて跳ぶ。
  // 泡が付いたかたまりのノミは消える
  const JUMP = 0.45;
  const fleas = Array.from({ length: FLEAS }, () => ({
    spot: 0,
    k: 0,
    from: new THREE.Vector3(),
    high: 0,
    sit: 0,
    jump: 0,
    alive: false
  }));
  const rel = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3();
  const fleaAt = (spot: number, k: number, out: THREE.Vector3) =>
    out.copy(rig.foamSpots[spot].bubbles[k].at).applyMatrix4(rel.multiplyMatrices(inv, rig.foamBase[spot].matrixWorld));
  function hop(f: (typeof fleas)[number], first = false) {
    const from = rig.foamSpots[f.spot].bubbles[0].at;
    const near = rig.foamSpots
      .map((sp, i) => i)
      .filter((i) => foam[i] < 0.25 && (first || rig.foamSpots[i].bubbles[0].at.distanceTo(from) < 0.45));
    if (!near.length) return (f.alive = false);
    if (first || Math.random() > 0.4) f.spot = near[Math.floor(Math.random() * near.length)];
    f.k = Math.floor(Math.random() * BUBBLES);
    f.high = 0.2 + Math.random() * 0.25;
  }
  function hatch() {
    for (const f of fleas) {
      f.alive = true;
      hop(f, true);
      f.sit = Math.random() * 1.5;
      f.jump = 0;
    }
  }
  function stepFleas(dt: number) {
    const m = rig.fleas;
    m.visible = dirty === 1 && fleas.some((f) => f.alive);
    if (!m.visible) return;
    rig.root.updateMatrixWorld(true);
    inv.copy(rig.root.matrixWorld).invert();
    fleas.forEach((f, i) => {
      if (f.alive && foam[f.spot] > 0.25) f.alive = false;
      if (!f.alive) return m.setMatrixAt(i, bubble.makeScale(0, 0, 0));
      fleaAt(f.spot, f.k, fp);
      fs.set(0.026, 0.021, 0.033);
      if (f.jump > 0) {
        f.jump -= dt;
        const u = 1 - Math.max(0, f.jump) / JUMP;
        fp.lerpVectors(f.from, fp, u);
        fp.y += f.high * Math.sin(Math.PI * u);
        // 跳ぶあいだは縦にのびる
        fs.set(0.02, 0.04, 0.026);
        if (f.jump <= 0) f.sit = 0.15 + Math.random() * 0.9;
      } else if ((f.sit -= dt) <= 0) {
        f.from.copy(fp);
        hop(f);
        f.jump = JUMP;
      }
      m.setMatrixAt(i, bubble.compose(fp, noTurn, fs));
    });
    m.instanceMatrix.needsUpdate = true;
  }

  const paw = new THREE.Vector3();
  const tuck = new THREE.Vector3();
  const chestPos = new THREE.Vector3();
  const chestQ = new THREE.Quaternion();

  const cur = target(kind, 'stand', 0, { speed: 0, wag: 0 });
  let action: PetAction = 'stand';
  let since = 0;
  let step = 0;
  let wagPh = 0;
  let breathPh = 0;
  let chewPh = 0;
  let prancePh = 0;
  let shakePh = 0;
  let spin = 0;
  let air = 0;
  let blink = 3;
  let prevEye = cur.eye;
  let earV = 0;
  let earX = 0;
  let lastY = 0;
  let lastVy = 0;

  function update(next: PetAction, dt: number, o: { speed: number; wag: number; look: number; t: number }) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (next !== action) {
      action = next;
      since = 0;
    } else since += dt;
    const goal = target(kind, action, since, o);
    goal.hy += o.look * 0.6;
    if (look.low) shorten(goal, look.low, shoulder, chestAt, kind === 'cat' ? 0.88 : 0.72);
    if (look.lie) goal.y += look.lie * Math.min(1, Math.abs(goal.roll));
    const rate = action === 'jump' || action === 'swat' ? 14 : 9;
    for (const k of KEYS) cur[k] = THREE.MathUtils.damp(cur[k], goal[k], rate, dt);
    cur.eye = prevEye = reopen(prevEye, goal.eye, cur.eye, dt);

    // 足運びの速さは体の進む速さから決め、足が床の上ですべらないようにする
    const run = cur.gait;
    const duty = 0.62 - 0.24 * run;
    const stride = 0.5 + 0.32 * run;
    const v = (o.speed * 1.5) / look.S;
    const freq = Math.max(1.3 + 1 * run, (v * duty) / stride);
    const stance = Math.min(stride, (v * duty) / freq) * (v > 0.05 ? 1 : 0.4);
    const walking = cur.swing > 0.02;
    if (walking) step += dt * freq;
    wagPh +=
      dt *
      Math.PI *
      2 *
      (action === 'flick'
        ? 5.5
        : action === 'bliss' && kind === 'dog'
          ? 1.4
          : kind === 'cat'
            ? action === 'happy'
              ? 9
              : 0.9
            : action === 'happy'
              ? 6.5
              : 4.5);
    breathPh += dt * Math.PI * 2 * (action === 'sleep' ? 0.35 : 0.8);
    chewPh += dt * Math.PI * 2 * 4;
    prancePh += dt * Math.PI * 2 * (kind === 'cat' ? 1.4 : action === 'roll' ? 3 : 2.6);
    // 犬も猫も 1 秒に 4〜5 回ほど体をねじる
    shakePh += dt * Math.PI * 2 * 4.6;
    const shake = cur.shake * Math.sin(shakePh);
    // 頭が先に振れ、胴と腰があとから逆へねじれて追う
    const shakeHead = cur.shake * Math.sin(shakePh + 0.9);

    if (action === 'roll') spin = Math.PI * 2 * THREE.MathUtils.smoothstep((since - 0.25) / 0.9, 0, 1);
    else spin = THREE.MathUtils.damp(spin > Math.PI ? spin - Math.PI * 2 : spin, 0, 9, dt);
    // 跳んでいる途中で action が変わっても床へ瞬間移動しないよう、跳ぶ action の外では高さを寄せて下ろす
    air =
      action === 'jump'
        ? jumpArc(since)
        : action === 'pounce'
          ? pounceArc(since)
          : THREE.MathUtils.damp(air, 0, 10, dt);

    const ph = step * Math.PI * 2;
    const swing = cur.swing;
    const gallop = swing * run;
    const pitch = cur.pitch + gallop * 0.1 * Math.sin(ph);
    const wig = cur.wiggle * Math.sin(since * 14);
    tmp.e.set(-pitch, wig * 0.2 + cur.bend * -0.3 + shake * 0.12, cur.roll - shake * 0.18, 'YXZ');
    hips.quaternion.setFromEuler(tmp.e);
    // おすわりでは胴を腰で起こしても、肩の位置（前足の上）を保つ
    const sh = tmp.v
      .copy(shoulder)
      .sub(chestAt)
      .applyAxisAngle(X_AXIS, cur.spine)
      .add(chestAt)
      .applyQuaternion(hips.quaternion);
    const bob =
      cur.bob * (swing > 0.02 ? Math.cos(ph * 2) * (1 - run) + Math.sin(ph) * run : Math.abs(Math.sin(prancePh)));
    hips.position.set(
      -wig * 0.04,
      hipsRest.y + cur.y + bob + (shoulder.y - sh.y) * cur.level + cur.breath * 0.3 * Math.sin(breathPh),
      hipsRest.z + cur.z + (shoulder.z - sh.z) * cur.level
    );
    chest.rotation.set(
      cur.spine + gallop * 0.12 * Math.cos(ph) + cur.breath * Math.sin(breathPh),
      cur.bend - shake * 0.1,
      shake * 0.42
    );
    neck.rotation.set(
      cur.hp * 0.6 + cur.chew * 0.05 * Math.sin(chewPh) - cur.bob * 3 * Math.sin(ph * 2) * (1 - run),
      cur.hy * 0.5 + shakeHead * 0.25,
      shakeHead * 0.3,
      'YXZ'
    );
    // 胸で起こした分（spine が負）は首を立てたまま頭だけ戻し、顔を前へ向ける（shorten のおすわり）
    head.rotation.set(
      cur.hp * 0.4 - cur.pitch * 0.3 - cur.spine,
      cur.hy * 0.5 + shakeHead * 0.3,
      cur.hr + shakeHead * 0.55,
      'YXZ'
    );

    // roll は寝ころんだ体の真ん中を軸に回す
    const root = rig.root;
    root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin);
    root.position.copy(pivot).sub(tmp.w.copy(pivot).applyQuaternion(root.quaternion)).multiplyScalar(look.S);
    root.position.y += air * look.S;

    // 足
    chestQ.copy(hips.quaternion).multiply(chest.quaternion);
    chestPos.copy(chest.position).applyQuaternion(hips.quaternion).add(hips.position);
    const pr = cur.prance * Math.sin(prancePh);
    rig.legs.forEach((leg, i) => {
      const [pPos, pQ] = leg.front ? [chestPos, chestQ] : [hips.position, hips.quaternion];
      let z = leg.front ? cur.fz : cur.bz;
      let y = leg.front ? cur.fy : cur.by;
      let ang = leg.front ? cur.fa : cur.ba;
      let flex = 0;
      if (leg.front) flex += cur.ff;
      if (i === 1) {
        flex += cur.frf;
        z += cur.frz;
        y += cur.fry;
        ang += cur.fra;
      }
      if (i === 3) {
        z += cur.brz;
        y += cur.bry;
        ang += cur.bra;
      }
      if (leg.front) y += 0.22 * Math.max(0, leg.side * pr);
      if (swing > 0.001) {
        const u = (((step + WALK_PHASE[i] * (1 - run) + RUN_PHASE[i] * run) % 1) + 1) % 1;
        const lift = 0.12 + 0.14 * run;
        if (u < duty) z += swing * stance * (0.5 - u / duty);
        else {
          const s = (u - duty) / (1 - duty);
          z += swing * stance * (-0.5 + THREE.MathUtils.smootherstep(s, 0, 1));
          y += swing * lift * Math.sin(Math.PI * s);
          const bend = Math.sin(Math.PI * Math.min(1, s * 1.3));
          ang -= swing * bend * (leg.front ? 1.4 : 0.5);
          flex += swing * bend * (leg.front ? 0.9 : 0.5);
        }
      }
      // 右後ろ足だけは外へも開ける（体をかく足を胴の外へ出す）
      paw.copy(leg.rest[3]).add(tmp.d.set(i === 3 ? -cur.brx : 0, y, z + cur.z));
      if (cur.tuck > 0.001 || cur.reach > 0.001) {
        const j = tmp.s.copy(leg.bones[0].position).applyQuaternion(pQ).add(pPos);
        tuck
          .set(0, -0.32, leg.front ? 0.12 : 0.2)
          .applyQuaternion(pQ)
          .add(j);
        paw.lerp(tuck, cur.tuck);
        tuck
          .set(0, -0.3, leg.front ? 0.42 : -0.5)
          .applyQuaternion(pQ)
          .add(j);
        paw.lerp(tuck, cur.reach);
        ang -= (cur.tuck + cur.reach * 0.6) * (leg.front ? 1.2 : 0.4);
        flex += cur.tuck * 0.8;
      }
      solveLeg(leg, pPos, pQ, paw, ang, flex, cur.splay);
    });

    const carrying = rig.mouth.children.length > 0;
    jaw.rotation.x = Math.max(cur.jaw * 0.45, carrying ? 0.3 : 0) + cur.chew * 0.18 * (1 + Math.sin(chewPh));
    for (const m of rig.inner) m.visible = jaw.rotation.x > 0.06;
    const tg = cur.tongue * Math.min(1, jaw.rotation.x * 3);
    // 舌先がくちびるより前へ出るよう、前へのばす
    rig.tongue.position.copy(rig.tongueAt).add(tmp.v.set(0, -0.01 * tg, 0.03 * tg));
    rig.tongue.scale.set(
      look.tongue.r[0] * (1 + tg * 0.15),
      look.tongue.r[1] * (1 + tg * 0.6),
      look.tongue.r[2] * (1 + tg * 0.5)
    );

    blink -= dt;
    if (blink < -0.13) blink = 2 + Math.random() * 3.5;
    const open = THREE.MathUtils.clamp(cur.eye * (blink < 0 ? 0 : 1), 0, 1.2);
    for (const o of rig.eyeParts) o.visible = open > 0.3;
    for (const l of rig.lids) {
      // 開いても上まぶたは目の上 1/4 にかぶさり、暗いふちがアイラインになる。
      // 奥まで回すと、ふちが目の上へ抜けて眉のような弧に見える
      l.upper.rotation.x = THREE.MathUtils.lerp(1.55, -0.48, Math.min(open, 1)) - Math.max(0, open - 1) * 0.3;
      // 下まぶたのふちは目の穴の下の端。笑うと上がって ^^ の形になる
      l.lower.rotation.x = THREE.MathUtils.lerp(0.95, 0.05, cur.smile);
    }
    // 猫は目のまわりの毛をたてにつぶして閉じる。開いていても少しつぶし、上下のふちを瞳にかぶせてやわらかい目つきにする
    for (const e of eyeBones) e.scale.y = THREE.MathUtils.lerp(0.06, 0.82, Math.min(open, 1));
    // うっとり・寝るときは丸い弧、ふつうのまばたきは平たい線
    const arc = Math.max(cur.smile, 1 - cur.eye * 3);
    for (const l of rig.lashes) {
      l.visible = open < 0.15;
      l.scale.y = THREE.MathUtils.clamp(arc, 0.25, 1);
    }

    // 垂れ耳は体の上下の加速度で揺らす。跳ねたり弾んだりすると耳がぱたぱたする
    if (dt > 0) {
      const y = root.position.y + hips.position.y * look.S;
      const vy = (y - lastY) / dt;
      const ay = THREE.MathUtils.clamp((vy - lastVy) / dt, -60, 60);
      lastY = y;
      lastVy = vy;
      earV += (-earX * 160 - earV * 9 - ay * 0.02) * dt;
    }
    earX = THREE.MathUtils.clamp(earX + earV * dt, -0.5, 0.5);
    // ぶるぶるでは、頭のねじれに遅れて耳が外へぱたぱた開く
    const flap = cur.shake * Math.sin(shakePh - 0.6);
    ears.forEach((e, i) => {
      const sx = i === 0 ? 1 : -1;
      if (look.ears === 'prick') e.rotation.set(-cur.ear * 0.55, 0, -sx * cur.ear * 0.25 + flap * 0.35);
      else e.rotation.set(-cur.ear * 0.3, 0, sx * (earX * 1.2 + cur.ear * 0.15) + flap * 0.6);
    });

    const wag = cur.wag * (kind === 'cat' ? 0.5 : 0.6) * Math.sin(wagPh);
    // 根元は持ち上げてから横へ回す（体に沿わせるため）。振るのは 2 つ目の骨で、根元の向きに対して左右に振る
    tail[0].rotation.set(cur.tail, cur.tailYaw - shake * 0.5, 0, 'YXZ');
    // 猫のしっぽは床と体の向きで決める。おすわりで腰を起こしても、床に沿って前足へ回せるように
    if (kind === 'cat') tail[0].quaternion.premultiply(tmp.q.copy(hips.quaternion).invert());
    tail.forEach((seg, i) => {
      if (i === 0) return;
      const tip = i / (tail.length - 1);
      seg.rotation.set(
        kind === 'cat' ? cur.curl * (0.1 + 0.5 * tip) - cur.tail * 0.12 : cur.curl * 0.1,
        cur.tailBend + (i === 1 ? wag : 0) + (kind === 'cat' ? cur.wag * 0.3 * Math.sin(wagPh - i * 0.6) : 0),
        0
      );
    });
    stepFleas(dt);
  }

  update('stand', 0, { speed: 0, wag: 0, look: 0, t: 0 });

  return {
    group,
    // 画質を変えると口も作り直すので、いつも今の口を返す（world3d はおもちゃを付け直す）
    get mouth() {
      return rig.mouth;
    },
    update,
    setAccessory(id) {
      worn = id;
      wear();
    },
    setDirt(v) {
      // 汚れも 4 段にして material を差し替える（ぬれと同じく、段ごとに material を共有する）
      const next = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 3) / 3;
      if (next === dirty) return;
      dirty = next;
      coat();
      if (dirty === 1) hatch();
    },
    setWet(v) {
      // ponytail: ぬれ具合は 5 段にして material を差し替える。段が目に見えるならつなぎの段を増やす
      const next = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 4) / 4;
      if (next === wet) return;
      wet = next;
      coat();
    },
    setFoam(levels) {
      for (let i = 0; i < FOAM_SPOTS; i++) foam[i] = THREE.MathUtils.clamp(levels[i] ?? 0, 0, 1);
      showFoam();
    },
    foamAt(i, out) {
      return out.copy(rig.foamSpots[i].bubbles[0].at).applyMatrix4(rig.foamBase[i].matrixWorld);
    },
    setQuality(q) {
      const toy = rig.mouth.children.slice();
      mount(q);
      for (const o of toy) rig.mouth.add(o);
    },
    dispose() {
      group.removeFromParent();
    }
  };
}
