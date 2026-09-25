import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Look } from './looks';
import { field, type Field } from './sculpt';
import type { AccessoryId } from './types';

/**
 * 首輪・リボン・バンダナ・ぼうし。首に巻く物は体の面を測って首の太さと毛の長さに合わせ、
 * 体と同じ骨で曲げる（SkinnedMesh）。首を曲げても、巻いた所の毛と一緒に動いてずれない。
 * ぼうしは頭の骨に付け、耳のあいだに収まる大きさにする。形は肩の高さを 1 とした体の座標で作る
 */

export interface Fit {
  look: Look;
  /** breed と画質。測った首まわりと作った形の使い回しに使う */
  key: string;
  /** 削る形を除いた体の形 */
  field: Field;
  /** 体の面（殻用の粗い面）。頂点ごとの骨の重さと毛の長さを借りる */
  body: THREE.BufferGeometry;
  skeleton: THREE.Skeleton;
}

type Skin = { index: number[]; weight: number[] };

interface Sample {
  /** 地肌の点と、首の中心から外への向き */
  at: THREE.Vector3;
  out: THREE.Vector3;
  fur: number;
  skin: Skin;
}

interface Neck {
  c: THREE.Vector3;
  /** 首の付け根から頭への向き */
  axis: THREE.Vector3;
  /** 首の太さ（地肌までの平均） */
  r: number;
  ring: Sample[];
  /** のどの前で、真下（重力）を首の面に沿わせた向き */
  down: THREE.Vector3;
}

/** 面が origin から dir へ出る所。origin は形の内側にあること */
export function hit(f: Field, origin: THREE.Vector3, dir: THREE.Vector3) {
  let lo = 0;
  let hi = 0.02;
  const p = new THREE.Vector3();
  while (hi < 1 && f(...(p.copy(origin).addScaledVector(dir, hi).toArray() as [number, number, number])) < 0) {
    lo = hi;
    hi += 0.02;
  }
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (f(...(p.copy(origin).addScaledVector(dir, m).toArray() as [number, number, number])) < 0) lo = m;
    else hi = m;
  }
  return origin.clone().addScaledVector(dir, (lo + hi) / 2);
}

const N = 48;
const necks = new Map<string, Neck>();
const shapes = new Map<string, THREE.BufferGeometry[]>();
const mats = new Map<string, THREE.Material>();

/** 体の面の頂点を CELL 角の升に分けた表。近い頂点を升のまわりだけで探す（総当たりだと付けるたびに止まる） */
const CELL = 0.06;
const buckets = new WeakMap<THREE.BufferGeometry, Map<string, number[]>>();
function bucketsOf(body: THREE.BufferGeometry) {
  let m = buckets.get(body);
  if (m) return m;
  m = new Map();
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.floor(pos.getX(i) / CELL)},${Math.floor(pos.getY(i) / CELL)},${Math.floor(pos.getZ(i) / CELL)}`;
    let list = m.get(k);
    if (!list) m.set(k, (list = []));
    list.push(i);
  }
  buckets.set(body, m);
  return m;
}

function nearest(body: THREE.BufferGeometry, p: THREE.Vector3): { fur: number; skin: Skin } {
  const pos = body.attributes.position;
  const m = bucketsOf(body);
  const [ci, cj, ck] = [p.x, p.y, p.z].map((v) => Math.floor(v / CELL));
  let best = 0;
  let bd = Infinity;
  // 升を内から 1 周ずつ広げる。r 周目の頂点は、点が升の端にあれば (r - 1) 升ぶんまで近づく
  for (let r = 0; r < 40 && bd > (Math.max(0, r - 1) * CELL) ** 2; r++)
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          for (const v of m.get(`${ci + i},${cj + j},${ck + k}`) ?? []) {
            const d = (pos.getX(v) - p.x) ** 2 + (pos.getY(v) - p.y) ** 2 + (pos.getZ(v) - p.z) ** 2;
            if (d < bd) [bd, best] = [d, v];
          }
        }
  const si = body.attributes.skinIndex;
  const sw = body.attributes.skinWeight;
  return {
    fur: body.attributes.furLen.getX(best),
    skin: {
      index: [0, 1, 2, 3].map((k) => si.getComponent(best, k)),
      weight: [0, 1, 2, 3].map((k) => sw.getComponent(best, k))
    }
  };
}

/**
 * 首に巻く物は首の骨だけで動かす。まわりの面の重さを借りると、うなじ側は後頭部や肩の点に引かれ、
 * 頭を下げる（食べる・寝る）と首だけが下がって帯が宙に残る
 */
function neckSkin(skeleton: THREE.Skeleton): Skin {
  return { index: [skeleton.bones.findIndex((b) => b.name === 'neck'), 0, 0, 0], weight: [1, 0, 0, 0] };
}

/** 首輪を巻く高さで首を 1 周測る。前（θ = 0）がのど */
function neckOf(fit: Fit): Neck {
  let n = necks.get(fit.key);
  if (n) return n;
  const c = new THREE.Vector3(...fit.look.collar.at);
  // 首の軸に直角だと、のどの前は胸まで下がり、うなじ側は頭の後ろにかかる（頭を下げると浮く）。
  // 輪を水平に寄せて、前はあごの下、後ろはうなじに巻く
  const axis = new THREE.Vector3(...fit.look.collar.axis)
    .normalize()
    .add(new THREE.Vector3(0, 0.6, 0))
    .normalize();
  const side = new THREE.Vector3(1, 0, 0);
  const front = new THREE.Vector3().crossVectors(side, axis).normalize();
  const ring: Sample[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const out = front.clone().multiplyScalar(Math.cos(t)).addScaledVector(side, Math.sin(t));
    const at = hit(fit.field, c, out);
    ring.push({ at, out, fur: nearest(fit.body, at).fur, skin: neckSkin(fit.skeleton) });
  }
  // 顔の毛・耳のふちに当たって飛び出た点をならす
  const rad = ring.map((s) => s.at.distanceTo(c));
  const fur = ring.map((s) => s.fur);
  ring.forEach((s, i) => {
    const k = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((d) => (i + d + N) % N);
    const r = k.reduce((a, j) => a + rad[j], 0) / k.length;
    s.at.copy(c).addScaledVector(s.out, Math.min(rad[i], r * 1.02));
    s.fur = k.reduce((a, j) => a + fur[j], 0) / k.length;
  });
  const g = new THREE.Vector3(0, -1, 0);
  const down = g.addScaledVector(front, -g.dot(front)).normalize();
  n = { c, axis, r: rad.reduce((a, b) => a + b, 0) / N, ring, down };
  necks.set(fit.key, n);
  return n;
}

// ---- 形を組む道具 ----

/**
 * 形の頂点に骨の重さと色（なければ color）を付け、位置・法線・色・骨（uv なら uv も）だけの三角形の並びにそろえる。
 * skin が関数なら元の頂点の番号で呼ぶ
 */
function dress(g: THREE.BufferGeometry, skin: Skin | ((i: number) => Skin), color = '#ffffff', uv = false) {
  const src = g.clone();
  const n = src.attributes.position.count;
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const s = typeof skin === 'function' ? skin(i) : skin;
    index.set(s.index, i * 4);
    weight.set(s.weight, i * 4);
  }
  src.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  src.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  if (!src.attributes.color) {
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    src.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const out = src.index ? src.toNonIndexed() : src;
  const keep = ['position', 'normal', 'color', 'skinIndex', 'skinWeight', ...(uv ? ['uv'] : [])];
  for (const name of Object.keys(out.attributes)) if (!keep.includes(name)) out.deleteAttribute(name);
  return out;
}

/** 格子（行ごとの点の列）を三角形にした形 */
function grid(pts: THREE.Vector3[][], uvs?: [number, number][][]) {
  const rows = pts.length;
  const cols = pts[0].length;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  pts.forEach((row, j) =>
    row.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], (j * cols + i) * 3);
      if (uvs) uv.set(uvs[j][i], (j * cols + i) * 2);
    })
  );
  const idx: number[] = [];
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // 閉じた形も 1 枚の布も、法線が形の中心から外を向くよう三角形の向きをそろえる
  const mid = pts
    .flat()
    .reduce((a, p) => a.add(p), new THREE.Vector3())
    .multiplyScalar(1 / (rows * cols));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  let dot = 0;
  pts
    .flat()
    .forEach(
      (p, i) => (dot += nrm.getX(i) * (p.x - mid.x) + nrm.getY(i) * (p.y - mid.y) + nrm.getZ(i) * (p.z - mid.z))
    );
  if (dot < 0) {
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/**
 * 首に巻く帯。断面は幅 w・厚み t の角の丸い平たい楕円で、内側が地肌から毛の sink 倍の所に来る。
 * 骨の重さは首の測った点ごとに借りるので、首の曲がりに沿って曲がる
 */
function band(neck: Neck, o: { w: number; t: number; sink: number; lift?: number; repeat?: number; color?: string }) {
  const M = 12;
  const pts: THREE.Vector3[][] = [];
  const uvs: [number, number][][] = [];
  for (let j = 0; j <= M; j++) {
    const a = (j / M) * Math.PI * 2;
    // 平たい楕円より角ばらせて、革や布の帯らしい面を出す
    const ca = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.6;
    const sa = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.6;
    const row: THREE.Vector3[] = [];
    const uvRow: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const s = neck.ring[i % N];
      const mid = s.at
        .clone()
        .addScaledVector(s.out, s.fur * o.sink + o.t)
        .addScaledVector(neck.axis, o.lift ?? 0);
      row.push(mid.addScaledVector(neck.axis, (ca * o.w) / 2).addScaledVector(s.out, (sa * o.t) / 1));
      uvRow.push([(i / N) * (o.repeat ?? 1), j / M]);
    }
    pts.push(row);
    uvs.push(uvRow);
  }
  const g = grid(pts, uvs);
  const cols = N + 1;
  // 継ぎ目の法線をそろえる
  const nrm = g.attributes.normal;
  for (let j = 0; j <= M; j++) {
    const a = j * cols;
    const b = a + N;
    const n = new THREE.Vector3()
      .fromBufferAttribute(nrm, a)
      .add(new THREE.Vector3().fromBufferAttribute(nrm, b))
      .normalize();
    nrm.setXYZ(a, n.x, n.y, n.z);
    nrm.setXYZ(b, n.x, n.y, n.z);
  }
  return dress(g, (i) => neck.ring[(i % cols) % N].skin, o.color, o.repeat !== undefined);
}

/**
 * のどの前に物を置く向き。x がペットの左、y が上（顎のほう）、z が前。
 * のどの面は下を向いているので、そのままだと上から見る絵では平たく見える。前へ起こして正面に向ける
 */
function throat(neck: Neck, lift: number, out: number) {
  const s = neck.ring[0];
  const z = s.out
    .clone()
    .add(new THREE.Vector3(0, 0.5, 0))
    .normalize();
  const x = new THREE.Vector3(1, 0, 0);
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const at = s.at
    .clone()
    .addScaledVector(z, s.fur * 0.5 + out)
    .addScaledVector(neck.axis, lift);
  return { m: new THREE.Matrix4().makeBasis(x, y, z).setPosition(at), skin: s.skin, fur: s.fur };
}

function mesh(key: string, fit: Fit, make: () => THREE.BufferGeometry[], materials: THREE.Material[]) {
  const k = `${key}:${fit.key}`;
  let list = shapes.get(k);
  if (!list) shapes.set(k, (list = make()));
  return list.map((g, i) => {
    const m = new THREE.SkinnedMesh(g, materials[i]);
    m.bind(fit.skeleton, new THREE.Matrix4());
    // 骨で曲げた形は元の外接球からはみ出すので切り捨てない
    m.frustumCulled = false;
    m.castShadow = true;
    return m;
  });
}

// ---- 色と模様 ----

function material(key: string, make: () => THREE.Material) {
  let m = mats.get(key);
  if (!m) mats.set(key, (m = make()));
  return m;
}

/** w × h の模様を画素ごとの色で描く。canvas を使わないのは、テスト（happy-dom）でも同じに作れるように */
function paint(w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  const t = new THREE.DataTexture(data, w, h);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = (c: [number, number, number], k: number): [number, number, number] => [
  Math.min(255, c[0] * k),
  Math.min(255, c[1] * k),
  Math.min(255, c[2] * k)
];
const grain = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** 革のベルト。ふちを暗くして厚みを見せ、両ふちの内側に白い縫い目を点線で入れる（u が帯の長さ、v が幅） */
function leather(hex: string) {
  const base = rgb(hex);
  const thread = shade(base, 1.6);
  return paint(32, 32, (x, y) => {
    const v = (y + 0.5) / 32;
    const edge = Math.min(v, 1 - v);
    const stitch = (Math.abs(v - 0.22) < 0.035 || Math.abs(v - 0.78) < 0.035) && x % 8 < 5;
    if (stitch) return thread;
    return shade(base, (0.62 + 0.38 * Math.min(1, edge / 0.12)) * (0.94 + 0.08 * grain(x, y)));
  });
}

/** バンダナの布。地に白の水玉と、しずく形のペイズリー風の点 */
function bandanaCloth() {
  const base = rgb('#e2404f');
  const ink = rgb('#fff6ea');
  const dark = rgb('#8e1f33');
  const S = 64;
  return paint(S, S, (x, y) => {
    const d = (cx: number, cy: number) =>
      Math.hypot(((x - cx + S * 1.5) % S) - S / 2, ((y - cy + S * 1.5) % S) - S / 2);
    // しずく: 丸と、そこから斜めにのびる細い尾
    const drop = (cx: number, cy: number) => {
      const r = d(cx, cy);
      const tail = d(cx + 4, cy - 4) < 3.2 || d(cx + 7, cy - 7.5) < 1.8;
      return r < 5.2 || tail;
    };
    if (d(16, 16) < 4.2 || d(48, 48) < 4.2) return ink;
    if (drop(44, 18) || drop(12, 46)) return d(44, 18) < 2 || d(12, 46) < 2 ? dark : ink;
    if (d(32, 32) < 1.6 || d(0, 32) < 1.6 || d(32, 0) < 1.6) return ink;
    return shade(base, 0.96 + 0.06 * grain(x, y));
  });
}

/** 毛糸のゴム編み。縦の畝と、Vの編み目の明るさのむら、横じまを 2 本 */
function knit() {
  const main = rgb('#f5b731');
  const stripe = rgb('#fff3dc');
  return paint(64, 64, (x, y) => {
    const v = y / 64;
    const base = (v > 0.5 && v < 0.6) || (v > 0.7 && v < 0.8) ? stripe : main;
    const cx = (x % 4) / 3;
    const chevron = Math.abs(cx - 0.5) * 2;
    const row = ((y + chevron * 2) % 4) / 4;
    return shade(base, 0.8 + 0.28 * Math.sin(Math.PI * row) * (1 - 0.3 * chevron));
  });
}

// ---- アクセサリーごと ----

function collar(fit: Fit, id: 'collar-red' | 'collar-blue') {
  const neck = neckOf(fit);
  const R = neck.r;
  const red = id === 'collar-red';
  const w = R * 0.34;
  const t = R * 0.055;
  const [belt, metal] = mesh(
    id,
    fit,
    () => {
      const b = band(neck, { w, t, sink: 0.3, repeat: Math.round((Math.PI * 2 * R) / (w * 2.4)) });
      const { m, skin } = throat(neck, -w * 0.15, t * 2);
      const parts: THREE.BufferGeometry[] = [];
      // 帯から名札を下げる輪
      const ring = new THREE.TorusGeometry(R * 0.075, R * 0.018, 8, 20);
      ring.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -w * 0.45, R * 0.02));
      parts.push(ring);
      if (red) {
        // 鈴: 丸と、まわりの帯と、下の割れ目（色で暗くする）
        const r = R * 0.22;
        const bell = new THREE.SphereGeometry(r, 20, 14);
        const pos = bell.attributes.position;
        const col = new Float32Array(pos.count * 3).fill(1);
        for (let i = 0; i < pos.count; i++) {
          const [x, y, z] = [pos.getX(i) / r, pos.getY(i) / r, pos.getZ(i) / r];
          if (y < -0.25 && Math.abs(x) < 0.12 && z > 0) col.set([0.15, 0.1, 0.05], i * 3);
          else if (y < -0.55 && z > -0.2 && Math.hypot(x, z) < 0.5) col.set([0.15, 0.1, 0.05], i * 3);
        }
        bell.setAttribute('color', new THREE.BufferAttribute(col, 3));
        bell.translate(0, -w * 0.45 - R * 0.075 - r * 0.9, R * 0.02 + r * 0.25);
        const belt2 = new THREE.TorusGeometry(r * 0.98, r * 0.08, 6, 24);
        belt2.rotateX(Math.PI / 2);
        belt2.translate(0, -w * 0.45 - R * 0.075 - r * 0.9 + r * 0.1, R * 0.02 + r * 0.25);
        parts.push(bell, belt2);
      } else {
        // 骨の形の名札
        const s = R * 0.16;
        const shape = new THREE.Shape();
        shape.moveTo(-1.2 * s, -0.35 * s);
        shape.lineTo(1.2 * s, -0.35 * s);
        shape.absarc(1.35 * s, -0.55 * s, 0.4 * s, Math.PI * 0.75, Math.PI * 2.1, false);
        shape.absarc(1.35 * s, 0.55 * s, 0.4 * s, -Math.PI * 0.1, Math.PI * 1.25, false);
        shape.lineTo(-1.2 * s, 0.35 * s);
        shape.absarc(-1.35 * s, 0.55 * s, 0.4 * s, Math.PI * 1.75, Math.PI * 3.1, false);
        shape.absarc(-1.35 * s, -0.55 * s, 0.4 * s, Math.PI * 0.9, Math.PI * 2.25, false);
        const bone = new THREE.ExtrudeGeometry(shape, {
          depth: s * 0.25,
          bevelEnabled: true,
          bevelThickness: s * 0.12,
          bevelSize: s * 0.12,
          bevelSegments: 2,
          curveSegments: 8
        });
        bone.translate(0, -w * 0.45 - R * 0.075 - s * 1.1, R * 0.02);
        parts.push(bone);
      }
      const metal = mergeGeometries(
        parts.map((p) => {
          return dress(p.applyMatrix4(m), skin);
        })
      );
      return [b, metal];
    },
    [
      material(
        `leather:${id}`,
        () => new THREE.MeshStandardMaterial({ map: leather(red ? '#d8323f' : '#2f6fd6'), roughness: 0.55 })
      ),
      material(
        `metal:${id}`,
        () =>
          new THREE.MeshStandardMaterial({
            color: '#f5c542',
            vertexColors: true,
            metalness: 0.85,
            roughness: 0.25,
            envMapIntensity: 2.2
          })
      )
    ]
  );
  return [belt, metal];
}

/** 蝶結びの羽 1 枚。結び目から外へ、付け根は細く先は丸くふくらみ、前の面に折り目のくぼみがある */
function wing(L: number, H: number, D: number, side: number) {
  const I = 14;
  const J = 16;
  const pts: THREE.Vector3[][] = [];
  for (let j = 0; j <= J; j++) {
    const a = (j / J) * Math.PI * 2;
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= I; i++) {
      const s = i / I;
      const h = H * (0.28 + 0.72 * s ** 0.7) * Math.sqrt(Math.max(0, 1 - s ** 5));
      const d = D * (0.45 + 0.55 * s) * Math.sqrt(Math.max(0, 1 - s ** 5));
      let y = Math.sin(a) * h;
      let z = Math.cos(a) * d;
      // 前の面のまん中を少しへこませて、布を折り返した輪に見せる
      if (z > 0) z *= 1 - 0.45 * Math.exp(-((y / (h * 0.45 + 1e-6)) ** 2)) * Math.sin(Math.PI * Math.min(1, s * 1.1));
      // 羽の先を少し下げる
      y -= s * s * H * 0.35;
      row.push(new THREE.Vector3(side * s * L, y, z));
    }
    pts.push(row);
  }
  return grid(pts);
}

/** 垂れ。結び目から下へ斜めにのび、先は V の字に切れている */
function tail(L: number, W: number, side: number) {
  const K = 10;
  const pts: THREE.Vector3[][] = [];
  for (let k = 0; k <= K; k++) {
    const s = k / K;
    const cx = side * (0.35 * s * L + 0.05 * L * Math.sin(s * Math.PI));
    const cy = -s * L;
    // 胸のふくらみに沿って、下へ行くほど少し前へ出る
    const cz = 0.12 * L * s + 0.05 * L * Math.sin(s * Math.PI * 1.3);
    const w = W * (0.8 + 0.2 * s);
    const notch = k === K ? W * 0.45 : 0;
    const row = [-1, 0, 1].map((u) => {
      const up = u === 0 ? notch : 0;
      return new THREE.Vector3(cx + u * (w / 2) * 0.95, cy + up + u * side * w * 0.12, cz + Math.abs(u) * W * 0.05);
    });
    pts.push(row);
  }
  return grid(pts);
}

function ribbon(fit: Fit) {
  const neck = neckOf(fit);
  const R = neck.r;
  const PINK = '#ff5fa2';
  const [m] = mesh(
    'ribbon',
    fit,
    () => {
      const b = band(neck, { w: R * 0.13, t: R * 0.03, sink: 0.3, color: PINK });
      const { m, skin } = throat(neck, -R * 0.06, R * 0.16);
      const L = R * 1.1;
      const parts = [
        dress(wing(L, R * 0.52, R * 0.26, 1), skin, PINK),
        dress(wing(L, R * 0.52, R * 0.26, -1), skin, PINK),
        dress(new THREE.SphereGeometry(R * 0.19, 14, 10).scale(1, 1.15, 0.8).translate(0, 0, R * 0.1), skin, '#e8468c'),
        dress(tail(R * 0.9, R * 0.26, 1).translate(R * 0.05, -R * 0.1, -R * 0.02), skin, '#f7549a'),
        dress(tail(R * 0.9, R * 0.26, -1).translate(-R * 0.05, -R * 0.1, -R * 0.02), skin, '#f7549a')
      ].map((g) => g.applyMatrix4(m));
      return [mergeGeometries([b, ...parts])];
    },
    [
      material(
        'satin',
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            vertexColors: true,
            roughness: 0.32,
            sheen: 1,
            sheenColor: new THREE.Color('#ffd6ea'),
            sheenRoughness: 0.35,
            side: THREE.DoubleSide
          })
      )
    ]
  );
  return [m];
}

const CHEST = new Set(['neck', 'brisket', 'rib', 'scap']);

function bandana(fit: Fit) {
  const neck = neckOf(fit);
  const R = neck.r;
  const [m] = mesh(
    'bandana',
    fit,
    () => {
      const w = R * 0.26;
      const sink = 0.35;
      // 前足の付け根のでこぼこを拾わないよう、首と胸の形だけに沿わせる
      const chest = field(fit.look.shapes.filter((s) => CHEST.has(s.tag)));
      const roll = band(neck, { w, t: R * 0.07, sink, repeat: 6 });
      // 胸に垂れる三角の布。上の辺は巻いた布の下のふちに沿い、先はのどの前から下へ
      const I = 16;
      const J = 10;
      const span = Math.PI * 0.5;
      const front = neck.ring[0];
      const top = (u: number) => {
        const t = u * span;
        const i = Math.round((t / (Math.PI * 2)) * N + N) % N;
        const s = neck.ring[i];
        return {
          p: s.at
            .clone()
            .addScaledVector(s.out, s.fur * sink + R * 0.05)
            .addScaledVector(neck.axis, -w * 0.3),
          s
        };
      };
      const tip = front.at
        .clone()
        .addScaledVector(front.out, front.fur * sink)
        .addScaledVector(neck.axis, -w * 0.3)
        .add(new THREE.Vector3(0, -R * 1.3, R * 0.1));
      const x = new THREE.Vector3(1, 0, 0);
      const forward = front.out
        .clone()
        .add(new THREE.Vector3(0, 0.5, 0))
        .normalize();
      const pts: THREE.Vector3[][] = [];
      const uvs: [number, number][][] = [];
      const skins: Skin[] = [];
      for (let j = 0; j <= J; j++) {
        const v = j / J;
        const row: THREE.Vector3[] = [];
        const uvRow: [number, number][] = [];
        for (let i = 0; i <= I; i++) {
          const u = (i / I) * 2 - 1;
          const p = top(u).p.lerp(tip, v);
          // 三角のふちを少しふくらませ、ネクタイのように細く見えないようにする
          if (v < 1) p.x *= (1 - v) ** -0.45;
          // 平らな三角を垂らし、胸にめりこむ所だけ前へ押し出して毛の上に乗せる。胸から離れる所は宙に垂れる
          const near = nearest(fit.body, p);
          const lift = near.fur * 0.85 + R * (0.03 + 0.04 * Math.sin(Math.PI * v) * (1 - Math.abs(u)));
          for (let k = 0; k < 60 && chest(p.x, p.y, p.z) < lift; k++) p.addScaledVector(forward, R * 0.015);
          const q = p;
          row.push(q);
          uvRow.push([q.dot(x) / (R * 0.7), q.clone().sub(front.at).dot(neck.down) / (R * 0.7)]);
          skins.push(near.skin);
        }
        pts.push(row);
        uvs.push(uvRow);
      }
      const cloth = dress(grid(pts, uvs), (i) => skins[i], '#ffffff', true);
      return [mergeGeometries([roll, cloth])];
    },
    [
      material(
        'bandana',
        () => new THREE.MeshStandardMaterial({ map: bandanaCloth(), roughness: 0.85, side: THREE.DoubleSide })
      )
    ]
  );
  return [m];
}

/**
 * 小さなニット帽。頭のてっぺんの面を測って、耳にかからない大きさの輪を頭に沿わせて置き、
 * そこから丸くふくらませる。上にぼんぼん
 */
function hatShapes(fit: Fit) {
  const look = fit.look;
  const skull = look.shapes.find((s) => s.tag === 'skull' && s.ell)!;
  const center = new THREE.Vector3(...skull.a);
  const ears = field(look.shapes.filter((s) => s.tag === 'ear'));
  const skullR = skull.ell![0];
  const cap = skullR * 0.62;
  const e1 = new THREE.Vector3(1, 0, 0);
  const place = (tilt: number) => {
    const up = new THREE.Vector3(0, 1, tilt).normalize();
    const crown = hit(fit.field, center, up);
    const e2 = new THREE.Vector3().crossVectors(up, e1).normalize();
    const ringAt = (r: number, a: number) => {
      const q = crown
        .clone()
        .addScaledVector(e1, Math.cos(a) * r)
        .addScaledVector(e2, Math.sin(a) * r);
      return hit(fit.field, center, q.sub(center).normalize());
    };
    // 輪とふくらみが耳の面から頭の 5% ほど離れる
    const clear = (r: number) => {
      for (let k = 0; k < 24; k++) {
        const p = ringAt(r, (k / 24) * Math.PI * 2);
        for (const h of [0, 0.5, 0.9]) if (ears(p.x, p.y + h * r * 0.6, p.z) < skullR * 0.05) return false;
      }
      return true;
    };
    let r = cap;
    while (r > skullR * 0.3 && !clear(r)) r *= 0.94;
    return { up, r, ringAt };
  };
  // 立ち耳のあいだが狭い子は、額のほうへ寄せて大きさを保つ
  let best = place(0.05);
  for (const tilt of [0.15, 0.25, 0.35, 0.45, 0.6]) {
    if (best.r >= cap) break;
    const next = place(tilt);
    if (next.r > best.r * 1.03) best = next;
  }
  const { up, r, ringAt } = best;
  const K = 10;
  const M = 32;
  const base = Array.from({ length: M + 1 }, (_, k) => ringAt(r, (k / M) * Math.PI * 2));
  const mid = base
    .slice(0, M)
    .reduce((a, p) => a.add(p), new THREE.Vector3())
    .multiplyScalar(1 / M);
  const H = r * 0.95;
  const pts: THREE.Vector3[][] = [];
  const uvs: [number, number][][] = [];
  for (let j = 0; j <= K; j++) {
    const t = j / K;
    const a = (t * Math.PI) / 2;
    pts.push(
      base.map((b) =>
        mid
          .clone()
          .add(
            b
              .clone()
              .sub(mid)
              .multiplyScalar(Math.cos(a) * (1 + 0.08 * Math.sin(a * 2)))
          )
          .addScaledVector(up, Math.sin(a) * H + r * 0.05)
      )
    );
    uvs.push(base.map((_, k) => [(k / M) * 8, 0.2 + t * 0.8]));
  }
  // 折り返したゴム編みのふち
  const cuff: THREE.Vector3[][] = [];
  const cuv: [number, number][][] = [];
  for (let j = 0; j <= 10; j++) {
    const a = (j / 10) * Math.PI * 2;
    cuff.push(
      base.map((b) => {
        const out = b.clone().sub(mid).normalize();
        return b
          .clone()
          .addScaledVector(out, r * 0.06 + Math.cos(a) * r * 0.1)
          .addScaledVector(up, r * 0.12 + Math.sin(a) * r * 0.14);
      })
    );
    cuv.push(base.map((_, k) => [(k / M) * 16, 0.02 + (j / 10) * 0.12]));
  }
  const pom = new THREE.IcosahedronGeometry(r * 0.36, 3);
  const pp = pom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pp.count; i++) {
    v.fromBufferAttribute(pp, i);
    const bump = 1 + 0.12 * (Math.sin((v.x * 90) / r) * Math.sin((v.y * 90) / r) * Math.sin((v.z * 90) / r));
    pp.setXYZ(i, v.x * bump, v.y * bump, v.z * bump);
  }
  pom.computeVertexNormals();
  pom.translate(
    ...mid
      .clone()
      .addScaledVector(up, H + r * 0.3)
      .toArray()
  );
  const plain = (x: THREE.BufferGeometry) => {
    const o = x.index ? x.toNonIndexed() : x;
    for (const n of Object.keys(o.attributes))
      if (n !== 'position' && n !== 'normal' && n !== 'uv') o.deleteAttribute(n);
    return o;
  };
  return [mergeGeometries([plain(grid(pts, uvs)), plain(grid(cuff, cuv))]), plain(pom)];
}

function hat(fit: Fit) {
  const key = `hat:${fit.key}`;
  let list = shapes.get(key);
  if (!list) shapes.set(key, (list = hatShapes(fit)));
  const g = new THREE.Group();
  g.name = 'accessory';
  const knitMat = material('knit', () => new THREE.MeshStandardMaterial({ map: knit(), roughness: 0.95 }));
  const pomMat = material('pompom', () => new THREE.MeshStandardMaterial({ color: '#fff3e0', roughness: 1 }));
  for (const [geo, m] of [
    [list[0], knitMat],
    [list[1], pomMat]
  ] as const) {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

/** id のアクセサリー。hat は頭の骨の入れ物（head の関節を戻した座標）に、ほかは root に付ける */
export function accessory(id: AccessoryId, fit: Fit): { group: THREE.Group; on: 'head' | 'root' } {
  if (id === 'hat') {
    const g = hat(fit);
    g.userData.id = id;
    return { group: g, on: 'head' };
  }
  const g = new THREE.Group();
  g.name = 'accessory';
  g.userData.id = id;
  const meshes = id === 'ribbon' ? ribbon(fit) : id === 'bandana' ? bandana(fit) : collar(fit, id);
  g.add(...meshes);
  return { group: g, on: 'root' };
}
