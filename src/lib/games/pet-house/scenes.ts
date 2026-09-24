import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RANK_COLOR } from './contest';
import { CONTEST_IDS } from './engine';
import { PARK, ROOM } from './layout';
import type { ContestId } from './types';
import { box, cyl, geo, mat, mesh, sphere, torus } from './props';
import { concrete, fabric, foliage, lawn, paint, planks, plaster, rug, seeded, siding } from './textures';

/**
 * 部屋と公園の背景。ライトは world3d が置く。
 * 床・壁・遠景は影を受けるだけにする（背の高い壁が影を落とすと、光の向きによっては床が真っ暗になる）
 */

/** mat() と geo() の分はモジュールで共有していて次に開いたときも使うので、それ以外の geometry・material・texture だけ捨てる */
export function release(group: THREE.Group) {
  const seen = new Set<THREE.Material | THREE.BufferGeometry>();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const r of [o.geometry, o.material] as (THREE.Material | THREE.BufferGeometry)[]) {
      if (r.userData.shared || seen.has(r)) continue;
      seen.add(r);
      if (r instanceof THREE.Material)
        for (const v of Object.values(r)) if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
      r.dispose();
    }
  });
}

export const rounded = (w: number, h: number, d: number, r: number) =>
  geo(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));

/** 布の張り地。sheen で縁が明るく抜け、ビニールのようなつやが出ない */
function cloth(color: string, map: THREE.Texture, repeat: number) {
  const m = map.clone();
  m.repeat.set(repeat, repeat);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: m,
    roughness: 0.9,
    sheen: 0.7,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45)
  });
}

function sofa(weave: THREE.Texture) {
  const g = new THREE.Group();
  const green = cloth('#7f9d72', weave, 3);
  const w = 1.5;
  const d = 0.78;
  g.add(mesh(rounded(w, 0.2, d, 0.04), green, 0, 0.26, 0));
  g.add(mesh(rounded(w, 0.46, 0.16, 0.05), green, 0, 0.54, -d / 2 + 0.08));
  for (const s of [-1, 1]) {
    g.add(mesh(rounded(0.15, 0.3, d, 0.06), green, s * (w / 2 - 0.075), 0.46, 0));
    g.add(mesh(rounded(0.61, 0.13, d - 0.2, 0.05), green, s * 0.31, 0.42, 0.07));
    const back = mesh(rounded(0.6, 0.36, 0.14, 0.06), green, s * 0.31, 0.64, -d / 2 + 0.22);
    back.rotation.x = -0.14;
    g.add(back);
  }
  const walnut = mat('#5a3a24', { roughness: 0.5 });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = mesh(cyl(0.022, 0.012, 0.17, 10), walnut, sx * (w / 2 - 0.1), 0.085, sz * (d / 2 - 0.08));
      leg.rotation.set(sz * 0.18, 0, -sx * 0.18);
      g.add(leg);
    }
  const pillow = (color: string, x: number, tilt: number) => {
    const p = mesh(rounded(0.38, 0.36, 0.11, 0.05), cloth(color, weave, 1.5), x, 0.67, -0.12);
    p.rotation.set(-0.28, 0, tilt);
    g.add(p);
  };
  pillow('#c98a36', -0.46, 0.1);
  pillow('#a8453a', -0.14, -0.08);
  pillow('#e4dccb', 0.5, -0.05);
  return g;
}

/** 籐のかごに植えた背の高い観葉植物。葉は 1 つの形にまとめて、1 回の描画で済ませる */
function plant() {
  const g = new THREE.Group();
  const basket = paint(
    128,
    64,
    (c) => {
      c.fillStyle = '#c9ab78';
      c.fillRect(0, 0, 128, 64);
      for (let y = 0; y < 64; y += 4)
        for (let x = 0; x < 128; x += 8) {
          c.fillStyle = (x / 8 + y / 4) % 2 ? 'rgb(90 60 25 / 0.35)' : 'rgb(255 240 200 / 0.2)';
          c.fillRect(x, y, 8, 3);
        }
    },
    true
  );
  basket.repeat.set(3, 3);
  g.add(mesh(cyl(0.19, 0.15, 0.36, 24), new THREE.MeshStandardMaterial({ map: basket, roughness: 0.95 }), 0, 0.18, 0));
  g.add(mesh(cyl(0.175, 0.175, 0.02, 20), '#3b2a1c', 0, 0.35, 0, false));
  g.add(mesh(cyl(0.012, 0.02, 1.1, 6), '#5d4630', 0, 0.9, 0));

  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.bezierCurveTo(0.05, 0.05, 0.05, 0.16, 0, 0.22);
  leaf.bezierCurveTo(-0.05, 0.16, -0.05, 0.05, 0, 0);
  const base = new THREE.ShapeGeometry(leaf, 6);
  const rnd = seeded(29);
  const parts: THREE.BufferGeometry[] = [];
  const colors: number[] = [];
  const tones = [new THREE.Color('#4c7a3e'), new THREE.Color('#5f8c48'), new THREE.Color('#3d6a34')];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39;
    const h = 0.7 + rnd() * 0.85;
    q.setFromEuler(new THREE.Euler(-0.6 - rnd() * 0.6, -a, (rnd() - 0.5) * 0.4, 'YXZ'));
    const s = 0.8 + rnd() * 0.6;
    m.compose(new THREE.Vector3(Math.cos(a) * 0.04, h, Math.sin(a) * 0.04), q, new THREE.Vector3(s, s, s));
    const p = base.clone().applyMatrix4(m);
    const tone = tones[i % 3];
    for (let k = 0; k < p.attributes.position.count; k++) colors.push(tone.r, tone.g, tone.b);
    parts.push(p);
  }
  const leaves = mergeGeometries(parts)!;
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.add(
    mesh(
      leaves,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
      0,
      0,
      0
    )
  );
  base.dispose();
  for (const p of parts) p.dispose();
  return g;
}

function petBed(weave: THREE.Texture) {
  const g = new THREE.Group();
  const shell = cloth('#c77b62', weave, 4);
  const rim = mesh(
    geo('bed-rim', () => new THREE.TorusGeometry(0.28, 0.1, 16, 40)),
    shell,
    0,
    0.1,
    0
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 1.1;
  g.add(rim);
  g.add(mesh(cyl(0.3, 0.3, 0.08, 36), cloth('#e8cfc0', weave, 4), 0, 0.05, 0));
  return g;
}

/** 窓の外。明るく飛ばし気味にして、部屋の中との明るさの差を出す */
function outside() {
  return paint(256, 256, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#cfe6f6');
    sky.addColorStop(1, '#f4f9fb');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#b9d7a4';
    for (const [x, y, r] of [
      [30, 125, 55],
      [140, 105, 66],
      [240, 130, 52]
    ]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d6e9c4';
    g.fillRect(0, 195, 256, 61);
    g.fillStyle = '#ffffff';
    for (let x = 4; x < 256; x += 22) g.fillRect(x, 172, 10, 60);
    g.fillRect(0, 186, 256, 6);
    g.fillRect(0, 214, 256, 6);
  });
}

function windowFrame(width: number, height: number) {
  const g = new THREE.Group();
  // 窓の外は照明もトーンマップも通さず、そのままの明るさで見せる
  const view = new THREE.MeshBasicMaterial({ map: outside(), toneMapped: false });
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(width, height), view));
  const white = mat('#f4f1ea', { roughness: 0.5 });
  const t = 0.07;
  g.add(mesh(rounded(width + t, t, 0.06, 0.012), white, 0, height / 2, 0.02, false));
  g.add(mesh(rounded(width + t * 2.6, t * 1.2, 0.12, 0.015), white, 0, -height / 2, 0.04, false));
  for (const s of [-1, 1]) g.add(mesh(rounded(t, height, 0.06, 0.012), white, (s * width) / 2, 0, 0.02, false));
  g.add(mesh(rounded(0.035, height, 0.04, 0.008), white, 0, 0, 0.02, false));
  g.add(mesh(rounded(width, 0.035, 0.04, 0.008), white, 0, height * 0.1, 0.02, false));
  return g;
}

const WALL = { back: -2.45, side: 1.8, front: 2.6, height: 2.6 };
const SIDE_WINDOW = { z: -1.0, y: 1.3, w: 1.2, h: 1.1 };

/**
 * 横の窓から床へ落ちる日だまり。壁に影を落とさせないかわりに、窓の形を日の向きで床へ写した明るい面を重ねる。
 * 平行な光なので、窓の四隅を床へ写した四角形に窓の絵をそのまま貼れば形が合う
 */
function sunPatch(sun: THREE.Vector3) {
  const map = paint(256, 256, (g) => {
    g.filter = 'blur(5px)';
    g.fillStyle = '#ffffff';
    const m = 14;
    const midX = 128;
    // 窓の横桟は中心より高さの 1 割上にある
    const midY = 0.4 * 256;
    for (const [x0, x1] of [
      [m, midX - 5],
      [midX + 5, 256 - m]
    ])
      for (const [y0, y1] of [
        [m, midY - 5],
        [midY + 5, 256 - m]
      ])
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
  });
  const corner = (u: number, v: number) => {
    const y = SIDE_WINDOW.y + (v - 0.5) * SIDE_WINDOW.h;
    const z = SIDE_WINDOW.z + (u - 0.5) * SIDE_WINDOW.w;
    const k = y / sun.y;
    return [-WALL.side - sun.x * k, 0.012, z - sun.z * k];
  };
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)].flat(), 3)
  );
  geom.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geom.setIndex([0, 1, 2, 2, 1, 3]);
  const m = new THREE.MeshBasicMaterial({
    map,
    color: '#ffd9a0',
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3
  });
  const patch = new THREE.Mesh(geom, m);
  patch.renderOrder = 2;
  return patch;
}

/** ラグの両端の房。細い棒を 1 つの形にまとめる */
function fringe(width: number) {
  const parts: THREE.BufferGeometry[] = [];
  const rnd = seeded(31);
  for (let x = -width / 2 + 0.01; x < width / 2; x += 0.018) {
    const l = 0.05 + rnd() * 0.015;
    const b = new THREE.BoxGeometry(0.006, 0.003, l).translate(x, 0.004, l / 2);
    b.rotateY((rnd() - 0.5) * 0.12);
    parts.push(b);
  }
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

const SHELF = { w: 0.96, h: 0.64, d: 0.3, t: 0.025 };

/**
 * 窓の下の低い棚。コンテストで 1 位をとった階級のトロフィーを、上の階級から順に並べる。
 * 下の段の右には本を立てて、トロフィーが少ないうちもさびしく見えないようにする
 */
function trophyShelf(trophies: Partial<Record<ContestId, number>>) {
  const g = new THREE.Group();
  const wood = mat('#8a5a36', { roughness: 0.6 });
  const { w, h, d, t } = SHELF;
  for (const y of [t / 2, h / 2 - 0.01, h - t / 2]) g.add(mesh(rounded(w, t, d, 0.006), wood, 0, y, 0));
  for (const s of [-1, 1]) g.add(mesh(rounded(t, h, d, 0.006), wood, (s * (w - t)) / 2, h / 2, 0));
  g.add(mesh(box(w, h, 0.01), mat('#6e452a', { roughness: 0.7 }), 0, h / 2, -d / 2 + 0.005, false));
  const books = ['#3f5f8a', '#a8453a', '#e0c36a', '#5d7d52'];
  books.forEach((c, i) => {
    const bh = 0.2 + (i % 2) * 0.04;
    const b = mesh(box(0.035, bh, 0.19), mat(c, { roughness: 0.8 }), w / 2 - 0.06 - i * 0.04, t + bh / 2, 0.01);
    if (i === 3) b.rotation.z = 0.18;
    g.add(b);
  });
  const list = CONTEST_IDS.flatMap((id) => Array.from({ length: trophies[id] ?? 0 }, (_, rank) => rank)).sort(
    (a, b) => b - a
  );
  list.forEach((rank, i) => {
    const top = i < 10;
    const k = top ? i : i - 10;
    const cup = trophy(rank);
    // 上の段は、よいものから右（部屋のまん中の側）に並べる。棚の左はしは画面の外に切れやすい。
    // 下の段は右に本があるので、左からつめて並べる
    const x = top ? w / 2 - 0.07 - k * 0.088 : -w / 2 + 0.07 + k * 0.07;
    cup.position.set(x, top ? h : h / 2 - 0.01 + t / 2, 0.02);
    cup.rotation.y = (k % 2 ? 0.25 : -0.25) + 0.1;
    g.add(cup);
  });
  return g;
}

/** 金属の優勝カップ。上の階級ほど大きく、チャンピオンは虹色に光る */
function trophy(rank: number) {
  const g = new THREE.Group();
  const color = RANK_COLOR[rank];
  const metal =
    rank === 4
      ? mat(color, { metalness: 0.7, roughness: 0.15 }, { iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 })
      : mat(color, { metalness: 0.9, roughness: 0.28 });
  const cupShape = geo('trophy-cup', () => {
    const pts = [
      [0, 0],
      [0.012, 0.004],
      [0.03, 0.022],
      [0.04, 0.05],
      [0.042, 0.075],
      [0.038, 0.076]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 24);
  });
  const s = 1 + rank * 0.09;
  g.add(mesh(box(0.06, 0.018, 0.06), mat('#3a2a20', { roughness: 0.5 }), 0, 0.009, 0));
  g.add(mesh(cyl(0.016, 0.022, 0.012, 16), metal, 0, 0.024, 0));
  g.add(mesh(cyl(0.006, 0.008, 0.04, 10), metal, 0, 0.05, 0));
  g.add(mesh(cupShape, metal, 0, 0.068, 0));
  for (const side of [-1, 1]) {
    g.add(mesh(torus(0.017, 0.0035, 6, 16), metal, side * 0.042, 0.115, 0));
  }
  g.scale.setScalar(s);
  return g;
}

export function buildRoom(
  sun: THREE.Vector3,
  trophies: Partial<Record<ContestId, number>>
): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const weave = fabric();

  const depth = WALL.front - WALL.back;
  const wood = planks();
  for (const t of [wood.map, wood.roughness]) t.repeat.set((WALL.side * 2) / 1.2, depth / 1.2);
  const floorMat = new THREE.MeshStandardMaterial({ map: wood.map, roughnessMap: wood.roughness, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL.side * 2, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (WALL.back + WALL.front) / 2;
  floor.receiveShadow = true;

  const rugW = 1.8;
  const rugD = 2.4;
  const rugMat = new THREE.MeshStandardMaterial({ map: rug(), roughness: 1 });
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(rugW, 0.008, rugD), rugMat);
  carpet.position.set(0, 0.004, -0.3);
  carpet.receiveShadow = true;
  group.add(floor, carpet);
  const tassels = fringe(rugW);
  const cream = mat('#e9dcc0', { roughness: 1 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(tassels, cream);
    f.position.set(0, 0, -0.3 + (s * rugD) / 2);
    f.rotation.y = s > 0 ? 0 : Math.PI;
    f.receiveShadow = true;
    group.add(f);
  }

  const wallMap = plaster();
  wallMap.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#eee8de', map: wallMap, roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(WALL.side * 2, WALL.height), wallMat);
  back.position.set(0, WALL.height / 2, WALL.back);
  back.receiveShadow = true;
  group.add(back);
  const trim = mat('#f7f4ee', { roughness: 0.45 });
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, WALL.height), wallMat);
    side.rotation.y = -s * (Math.PI / 2);
    side.position.set(s * WALL.side, WALL.height / 2, (WALL.back + WALL.front) / 2);
    side.receiveShadow = true;
    group.add(side);
    group.add(mesh(rounded(0.025, 0.12, depth, 0.008), trim, s * (WALL.side - 0.012), 0.06, side.position.z, false));
  }
  group.add(mesh(rounded(WALL.side * 2, 0.12, 0.025, 0.008), trim, 0, 0.06, WALL.back + 0.012, false));

  const win = windowFrame(1.0, 1.1);
  win.position.set(-1.0, 1.3, WALL.back + 0.005);
  group.add(win);
  const side = windowFrame(SIDE_WINDOW.w, SIDE_WINDOW.h);
  side.rotation.y = Math.PI / 2;
  side.position.set(-WALL.side + 0.005, SIDE_WINDOW.y, SIDE_WINDOW.z);
  group.add(side, sunPatch(sun));

  const couch = sofa(weave);
  couch.position.set(0.2, 0, -2.05);
  group.add(couch);

  const pot = plant();
  pot.position.set(ROOM.blocks[2].x, 0, ROOM.blocks[2].z);
  group.add(pot);

  const bed = petBed(weave);
  bed.position.set(ROOM.bed.x, 0, ROOM.bed.z);
  group.add(bed);

  // ペットは奥の壁ぎわ（bounds の外）まで来ないので、棚に当たりは付けない
  const shelf = trophyShelf(trophies);
  shelf.position.set(-1.05, 0, WALL.back + 0.17);
  group.add(shelf);

  const matMap = paint(128, 256, (g) => {
    g.fillStyle = '#9cc7d6';
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = '#eef6f8';
    g.lineWidth = 4;
    g.strokeRect(10, 10, 108, 236);
  });
  const placemat = mesh(
    rounded(0.42, 0.006, 0.84, 0.003),
    new THREE.MeshStandardMaterial({ map: matMap, roughness: 0.55 }),
    ROOM.food.x,
    0.003,
    (ROOM.food.z + ROOM.water.z) / 2,
    false
  );
  group.add(placemat);

  return { group, dispose: () => release(group) };
}

export function skyDome() {
  const map = paint(8, 256, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 256);
    s.addColorStop(0, '#6fa8d8');
    s.addColorStop(0.4, '#b4d3ea');
    s.addColorStop(0.5, '#e2edf2');
    s.addColorStop(1, '#e2edf2');
    g.fillStyle = s;
    g.fillRect(0, 0, 8, 256);
  });
  const m = new THREE.MeshBasicMaterial({
    map,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY, 24, 16), m);
  dome.renderOrder = -1;
  return dome;
}

/** 空の半径。world3d のカメラの far はこれより大きくする */
const SKY = 30;

/**
 * でこぼこの葉むら。球の頂点を方向ごとのこぶで押し出し、葉の明暗を頂点の色で散らす。
 * 頂点をつないでから動かす（面ごとに別の頂点のまま動かすと継ぎ目が割れて白い筋が出る）
 */
function clump(r: number, seed: number) {
  return geo(`clump:${r}:${seed}`, () => {
    const src = new THREE.IcosahedronGeometry(r, 4);
    src.deleteAttribute('uv');
    src.deleteAttribute('normal');
    const g = mergeVertices(src);
    src.dispose();
    const rnd = seeded(seed);
    const p = g.attributes.position;
    const bumps = Array.from({ length: 14 }, () =>
      new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()
    );
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const colors: number[] = [];
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      let k = 0;
      for (const b of bumps) k += Math.max(0, n.dot(b)) ** 8;
      const hash = Math.abs(Math.sin(n.x * 127.1 + n.y * 311.7 + n.z * 74.7) * 43758.5453) % 1;
      v.copy(n).multiplyScalar(r * (0.82 + Math.min(k, 1) * 0.28 + hash * 0.05));
      // 下側は少し平らにつぶすと、枝の下から見上げたときの葉の天井に見える
      if (v.y < 0) v.y *= 0.7;
      p.setXYZ(i, v.x, v.y, v.z);
      // 上とこぶの先は日が当たって明るく、くぼみと下は暗い
      const lit = 0.62 + 0.2 * n.y + 0.25 * Math.min(k, 1) + (hash - 0.5) * 0.3;
      colors.push(lit, lit, lit);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  });
}

export function tree(scale: number, leaf: THREE.Material, shadow = true) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.08, 0.13, 1.3, 10), mat('#5e4633', { roughness: 0.95 }), 0, 0.65, 0, shadow));
  for (const [x, y, z, r, s] of [
    [0, 1.7, 0, 0.7, 1],
    [-0.42, 1.4, 0.12, 0.45, 2],
    [0.4, 1.45, -0.08, 0.5, 3],
    [0.05, 2.15, 0.05, 0.45, 4]
  ])
    g.add(mesh(clump(r, s), leaf, x, y, z, shadow));
  g.scale.setScalar(scale);
  return g;
}

export function bush(leaf: THREE.Material) {
  const g = new THREE.Group();
  for (const [x, z, r, s] of [
    [0, 0, 0.3, 5],
    [-0.2, 0.08, 0.22, 6],
    [0.19, 0.06, 0.24, 7]
  ])
    g.add(mesh(clump(r, s), leaf, x, r * 0.75, z));
  const flowers = ['#e8739c', '#f1c94a', '#f4f1ea'];
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    g.add(
      mesh(
        sphere(0.016, 8, 6),
        flowers[i % 3],
        Math.cos(a) * 0.26,
        0.18 + (i % 4) * 0.08,
        Math.sin(a) * 0.2 + 0.1,
        false
      )
    );
  }
  return g;
}

export function bench() {
  const g = new THREE.Group();
  const wood = mat('#9a6a42', { roughness: 0.7 });
  const iron = mat('#2c2f36', { roughness: 0.45, metalness: 0.6 });
  for (const z of [-0.08, 0.02, 0.12]) g.add(mesh(rounded(1.3, 0.035, 0.085, 0.01), wood, 0, 0.42, z));
  for (const y of [0.58, 0.7]) g.add(mesh(rounded(1.3, 0.08, 0.03, 0.01), wood, 0, y, -0.17));
  for (const s of [-1, 1]) {
    g.add(mesh(rounded(0.04, 0.42, 0.34, 0.01), iron, s * 0.55, 0.21, 0));
    g.add(mesh(rounded(0.04, 0.35, 0.035, 0.01), iron, s * 0.55, 0.6, -0.17));
  }
  return g;
}

/** 三角屋根の家。遠景なので影は落とさない */
export function house(wall: THREE.Material, roof: string, w: number, h: number) {
  const g = new THREE.Group();
  const d = 3;
  g.add(
    mesh(
      geo(`house:${w}:${h}`, () => new THREE.BoxGeometry(w, h, d)),
      wall,
      0,
      h / 2,
      0,
      false
    )
  );
  const gable = geo(`gable:${w}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.25, 0);
    s.lineTo(w / 2 + 0.25, 0);
    s.lineTo(0, w * 0.42);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d + 0.3, bevelEnabled: false }).translate(0, 0, -(d + 0.3) / 2);
  });
  g.add(mesh(gable, mat(roof, { roughness: 0.9 }), 0, h, 0, false));
  g.add(
    mesh(
      geo('chimney', () => new THREE.BoxGeometry(0.4, 1, 0.4)),
      '#8a4b3a',
      w * 0.25,
      h + w * 0.3,
      -0.6,
      false
    )
  );
  const frame = mat('#f7f4ee');
  const glass = mat('#3d4a58', { roughness: 0.15, metalness: 0.3 });
  for (const x of [-w * 0.28, w * 0.28])
    for (const y of [h * 0.3, h * 0.72]) {
      g.add(
        mesh(
          geo('win-frame', () => new THREE.BoxGeometry(0.62, 0.78, 0.05)),
          frame,
          x,
          y,
          d / 2 + 0.01,
          false
        )
      );
      g.add(
        mesh(
          geo('win-glass', () => new THREE.BoxGeometry(0.48, 0.64, 0.05)),
          glass,
          x,
          y,
          d / 2 + 0.03,
          false
        )
      );
    }
  g.add(
    mesh(
      geo('door', () => new THREE.BoxGeometry(0.55, 1.05, 0.05)),
      roof,
      0,
      0.53,
      d / 2 + 0.02,
      false
    )
  );
  return g;
}

/**
 * ペットのまわりの芝の葉。地面の絵だけでは平らに見えるので、細い三角を立てて足元をうずめる。
 * 1 つの InstancedMesh なので描画は 1 回で、影は落とさない。
 * 表と裏の三角を別に持ち、どちらも法線を上へ向ける（DoubleSide は裏で法線を裏返し、葉が黒く見える）
 */
let grassBlades: THREE.InstancedMesh | null = null;

/** 4 万本の配置は毎回同じなので、1 度作ったものを公園を開くたびに使い回す */
export function blades() {
  grassBlades ??= makeBlades();
  return grassBlades;
}

function makeBlades() {
  const blade = new THREE.BufferGeometry();
  const tri = [-0.003, 0, 0, 0.003, 0, 0, 0, 1, 0];
  blade.setAttribute('position', new THREE.Float32BufferAttribute([...tri, ...tri], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [0, 1, 0]).flat(), 3));
  blade.setIndex([0, 1, 2, 4, 3, 5]);
  const n = 40000;
  const m = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const rnd = seeded(37);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const { x0, x1, z0, z1 } = PARK.bounds;
  for (let i = 0; i < n; i++) {
    o.position.set(x0 - 0.8 + rnd() * (x1 - x0 + 1.6), 0, z0 + rnd() * (z1 - z0 + 1.2));
    o.rotation.set((rnd() - 0.5) * 0.6, rnd() * Math.PI, (rnd() - 0.5) * 0.6);
    const h = 0.02 + rnd() * 0.035;
    o.scale.set(1 + rnd(), h, 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, c.setHSL(0.24 + rnd() * 0.04, 0.4 + rnd() * 0.12, 0.3 + rnd() * 0.14));
  }
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.geometry.userData.shared = true;
  (m.material as THREE.Material).userData.shared = true;
  return m;
}

export function buildPark(): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();

  const grassMap = lawn();
  grassMap.repeat.set(60 / 3, 60 / 3);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -10;
  ground.receiveShadow = true;

  const walk = concrete();
  walk.repeat.set(40, 1);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.03, 1.4),
    new THREE.MeshStandardMaterial({ map: walk, roughness: 0.95 })
  );
  path.position.set(0, 0.015, -7.6);
  path.receiveShadow = true;
  group.add(ground, path, blades(), skyDome());

  const leaf = (color: string) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9 });
  const green = leaf('#628c42');
  const deep = leaf('#4f7a36');
  const blossom = leaf('#c79aad');

  const [a, b, c, d] = PARK.blocks;
  for (const [spot, s, l] of [
    [a, 0.9, green],
    [b, 1, deep],
    [d, 0.85, green]
  ] as const) {
    const t = tree(s, l);
    t.position.set(spot.x, 0, spot.z);
    t.rotation.y = spot.x * 3;
    group.add(t);
  }
  const shrub = bush(deep);
  shrub.position.set(c.x, 0, c.z);
  group.add(shrub);

  for (const x of [-0.7, 3.2]) {
    const seat = bench();
    seat.position.set(x, 0.03, -7.2);
    group.add(seat);
  }

  const hedgeMap = foliage(41);
  hedgeMap.repeat.set(60, 1);
  const hedge = mesh(
    rounded(40, 0.7, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: '#4a7433', map: hedgeMap, roughness: 0.95 }),
    0,
    0.35,
    -9.2,
    false
  );
  group.add(hedge);

  const board = siding();
  board.repeat.set(4, 4);
  const walls = ['#f1ece2', '#c9d7e2', '#e8e0cf', '#b7584a', '#dfe6ea', '#9fb3c4'].map(
    (color) => new THREE.MeshStandardMaterial({ color, map: board, roughness: 0.9 })
  );
  const roofs = ['#3d4450', '#6b4b3e', '#4a5363'];
  for (let i = 0; i < 9; i++) {
    const h = house(walls[i % walls.length], roofs[i % roofs.length], 3 + (i % 3) * 0.6, 2.8 + (i % 2) * 0.8);
    h.position.set(-19 + i * 4.8, 0, -21 - (i % 2) * 1.5);
    group.add(h);
  }
  for (let i = 0; i < 12; i++) {
    const t = tree(1.4 + (i % 3) * 0.3, i % 5 === 1 ? blossom : i % 2 ? green : deep, false);
    t.position.set(-19 + i * 3.4 + (i % 2), 0, -14 - (i % 3) * 1.5);
    group.add(t);
  }

  return { group, dispose: () => release(group) };
}
