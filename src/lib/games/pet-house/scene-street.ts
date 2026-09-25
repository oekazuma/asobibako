import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Built } from './activity';
import { box, cyl, mat, mesh, sphere } from './props';
import { lampGlass, pool } from './sky3d';
import { bench, bush, house, release, rounded, skyDome, tree } from './scenes';
import { concrete, foliage, lawn, paint, siding } from './textures';
import { CROSSING, LENGTH, POLE_X, POLES, SIDEWALK, type Stop } from './walk';

/**
 * おさんぽの道。左に芝と白い柵と家並み、右に縁石と車道、途中に横道と横断歩道、道の先に公園の入口。
 * 動かないものは材質ごとに 1 つの形へまとめる（家や柵を 1 つずつ描くと描画が数百回になる）
 */
export interface Street extends Built {
  /** リードを手元から首輪まで。slack はたるみ（m） */
  leash(hand: THREE.Vector3, neck: THREE.Vector3, slack: number): void;
  puddle(x: number, z: number): void;
  poop(x: number, z: number): void;
  clearPoop(): void;
  /** 体を横へ傾ける（おしっこの足上げ）。world3d が位置を書いたあとに毎フレーム掛けなおす */
  tilt(group: THREE.Object3D | null, roll: number): void;
}

const ROAD = { x0: 1.45, x1: 8.45 };
const BACK = 10;
const END = -LENGTH - 30;
const FENCE_X = -2.3;
const SLAB = 1.5;

export function buildStreet(stops: Stop[], camera: THREE.Camera): Street {
  const group = new THREE.Group();
  const still = new THREE.Group();
  ground(still);
  fences(still);
  homes(still);
  poles(still);
  for (const s of stops) {
    if (s.kind === 'hydrant') still.add(at(hydrant(), s.x, s.z));
    if (s.kind === 'smell') still.add(at(bush(leaf('#557f39')), SIDEWALK.x0 - 0.45, s.z, 0, 0.55));
  }
  // 芝の帯のベンチ。草むらや電柱と重なる所は飛ばす
  for (const z of [-15, -27, -54])
    if (!stops.some((s) => s.x < 0 && Math.abs(s.z - z) < 1.5) && !POLES.some((p) => Math.abs(p - z) < 1.5))
      still.add(at(bench(), -1.85, z, Math.PI / 2));
  entrance(still);
  const baked = bake(still);
  const sky = skyDome();
  group.add(baked, sky);

  const red = new THREE.MeshStandardMaterial({ color: '#d42a30', roughness: 0.55 });
  const rope = new THREE.Mesh(new THREE.BufferGeometry(), red);
  rope.castShadow = true;
  rope.frustumCulled = false;
  const pee = new THREE.MeshStandardMaterial({
    color: '#c9ad3c',
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  const puddles: { m: THREE.Mesh; t: number }[] = [];
  const dung = poopModel();
  dung.visible = false;
  group.add(rope, dung);
  let lean: { g: THREE.Object3D; roll: number } | null = null;

  return {
    group,
    dispose: () => {
      rope.geometry.dispose();
      release(group);
    },
    update(dt) {
      sky.position.copy(camera.position);
      for (const p of puddles) {
        p.t = Math.min(1, p.t + dt / 2);
        p.m.scale.setScalar(0.25 + 0.75 * p.t);
      }
      if (!lean) return;
      lean.g.rotation.z = lean.roll;
      // 傾けた下の側の足が地面へ沈まないよう、体ごと少し持ち上げる
      lean.g.position.y = Math.abs(lean.roll) * 0.09;
    },
    leash(hand, neck, slack) {
      const mid = hand.clone().lerp(neck, 0.55);
      mid.y -= Math.min(0.45, slack * 0.4);
      rope.geometry.dispose();
      rope.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hand, mid, neck), 24, 0.007, 5);
    },
    puddle(x, z) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2), pee);
      m.position.set(x, 0.065, z);
      m.receiveShadow = true;
      puddles.push({ m, t: 0 });
      group.add(m);
    },
    poop(x, z) {
      dung.position.set(x, 0.06, z);
      dung.visible = true;
    },
    clearPoop: () => void (dung.visible = false),
    tilt(g, roll) {
      if (lean && lean.g !== g) lean.g.rotation.z = 0;
      if (!g || roll === 0) {
        if (lean) lean.g.rotation.z = 0;
        lean = null;
        return;
      }
      lean = { g, roll };
    }
  };
}

const leaf = (color: string) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9 });

function at(o: THREE.Object3D, x: number, z: number, turn = 0, scale = 1) {
  o.position.set(x, 0, z);
  o.rotation.y = turn;
  o.scale.multiplyScalar(scale);
  return o;
}

/** z0 から z1 までを、横道のところだけ抜いた区間に分ける */
function spans(z0: number, z1: number): [number, number][] {
  const a = CROSSING.z + CROSSING.half;
  const b = CROSSING.z - CROSSING.half;
  return [
    [z0, a],
    [b, z1]
  ];
}

function textured(color: string, map: THREE.Texture, rx: number, ry: number) {
  const m = map.clone();
  m.userData.shared = false;
  m.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ color, map: m, roughness: 0.95 });
}

function ground(g: THREE.Group) {
  const len = BACK - END;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, len), textured('#ffffff', lawn(), 30, len / 3));
  grass.rotation.x = -Math.PI / 2;
  grass.position.z = (BACK + END) / 2;
  grass.receiveShadow = true;
  g.add(grass);

  // 板石のすき間から見える目地。板石を 4cm ずつあけて並べる
  const slab = textured('#e4e1da', concrete(), 1.5, 1);
  const seam = mat('#8d8a84', { roughness: 1 });
  const curb = mat('#cfccc5', { roughness: 0.9 });
  const walks: [number, number, number][] = [
    [SIDEWALK.x0, SIDEWALK.x1, -LENGTH],
    [ROAD.x1 + 0.15, ROAD.x1 + 2.15, END]
  ];
  for (const [x0, x1, zEnd] of walks)
    for (const [a, b] of spans(BACK, zEnd)) {
      const cx = (x0 + x1) / 2;
      g.add(mesh(box(x1 - x0, 0.03, a - b), seam, cx, 0.03, (a + b) / 2, false));
      for (let z = a; z > b + 0.5; z -= SLAB)
        g.add(mesh(box(x1 - x0, 0.03, SLAB - 0.04), slab, cx, 0.045, z - SLAB / 2));
      for (const x of [x0 === SIDEWALK.x0 ? x1 + 0.075 : x0 - 0.075])
        g.add(mesh(box(0.15, 0.14, a - b), curb, x, 0.07, (a + b) / 2, false));
    }

  const asphalt = textured('#6a6d72', concrete(), 3, len / 2);
  const w = ROAD.x1 - ROAD.x0;
  g.add(mesh(box(w, 0.02, len), asphalt, (ROAD.x0 + ROAD.x1) / 2, 0.01, (BACK + END) / 2, false));
  const side = textured('#6a6d72', concrete(), 12, 2);
  g.add(mesh(box(44, 0.024, CROSSING.half * 2), side, ROAD.x0 - 22, 0.012, CROSSING.z, false));

  const yellow = mat('#e2b93b', { roughness: 0.7 });
  const white = mat('#f4f3ee', { roughness: 0.7 });
  for (let z = BACK; z > END; z -= 6)
    g.add(mesh(box(0.13, 0.004, 3), yellow, (ROAD.x0 + ROAD.x1) / 2, 0.022, z, false));
  for (const x of [ROAD.x0 + 0.25, ROAD.x1 - 0.25])
    for (const [a, b] of spans(BACK, END)) g.add(mesh(box(0.1, 0.004, a - b), white, x, 0.022, (a + b) / 2, false));
  // 横道を渡る横断歩道と、車道を渡る横断歩道
  for (let z = CROSSING.z + CROSSING.half - 0.5; z > CROSSING.z - CROSSING.half + 0.3; z -= 0.9)
    g.add(mesh(box(2.6, 0.004, 0.45), white, 0, 0.026, z, false));
  const over = CROSSING.z - CROSSING.half - 1.8;
  for (let x = ROAD.x0 + 0.5; x < ROAD.x1 - 0.3; x += 0.9)
    g.add(mesh(box(0.45, 0.004, 3), white, x, 0.022, over, false));
  g.add(mesh(box(w / 2, 0.004, 0.3), white, ROAD.x0 + w * 0.75, 0.022, over + 2, false));
}

/** 白い柵 2.4m ぶんの形。先のとがった板を横木 2 本で留める */
function fencePiece() {
  const s = new THREE.Shape();
  s.moveTo(-0.037, 0);
  s.lineTo(0.037, 0);
  s.lineTo(0.037, 0.86);
  s.lineTo(0, 0.93);
  s.lineTo(-0.037, 0.86);
  s.closePath();
  const picket = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  const parts: THREE.BufferGeometry[] = [];
  for (let x = -1.125; x < 1.2; x += 0.15) parts.push(picket.clone().translate(x, 0, 0));
  for (const y of [0.28, 0.7])
    parts.push(new THREE.BoxGeometry(2.4, 0.07, 0.025).toNonIndexed().translate(0, y, -0.025));
  parts.push(new THREE.BoxGeometry(0.09, 1.02, 0.09).toNonIndexed().translate(-1.2, 0.51, -0.02));
  picket.dispose();
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  for (const p of parts) p.dispose();
  return g;
}

function fences(g: THREE.Group) {
  const piece = fencePiece();
  const paint = mat('#f6f5f0', { roughness: 0.6 });
  for (const [x, turn, zEnd] of [
    [FENCE_X, Math.PI / 2, -LENGTH + 1],
    [ROAD.x1 + 2.6, -Math.PI / 2, END]
  ] as const)
    for (const [a, b] of spans(BACK, zEnd))
      for (let z = a - 1.2; z > b + 1; z -= 2.4) g.add(at(mesh(piece, paint), x, z, turn));
}

function homes(g: THREE.Group) {
  const board = siding();
  board.repeat.set(4, 4);
  const walls = ['#f1ece2', '#c9d7e2', '#e8e0cf', '#b7584a', '#dfe6ea', '#9fb3c4'].map(
    (color) => new THREE.MeshStandardMaterial({ color, map: board, roughness: 0.9 })
  );
  const roofs = ['#3d4450', '#6b4b3e', '#4a5363', '#7a3b33'];
  const greens = [leaf('#628c42'), leaf('#4f7a36'), leaf('#6f9448')];
  let i = 0;
  for (const [x, turn, zEnd] of [
    [-6.8, Math.PI / 2, -LENGTH + 4],
    [14.6, -Math.PI / 2, END + 10]
  ] as const)
    for (const [a, b] of spans(BACK - 2, zEnd))
      for (let z = a - 4.5; z > b + 4; z -= 10, i++) {
        const h = house(walls[i % walls.length], roofs[i % roofs.length], 5 + (i % 3) * 0.8, 3 + (i % 2) * 1.2);
        g.add(at(h, x + (i % 2) * 0.8 * Math.sign(x), z, turn, 1.2));
        // 庭の木としげみは、柵と家の前の壁のあいだに置く
        const yard = x - Math.sign(x) * 3.1;
        g.add(at(tree(1.5 + (i % 3) * 0.3, greens[i % 3]), yard, z - 4.5, i));
        g.add(at(bush(greens[1]), yard, z + 2, i));
      }
  // 芝の帯の街路樹とベンチ
  for (let z = -4; z > -LENGTH + 3; z -= 13) {
    if (POLES.some((p) => Math.abs(p - z) < 2.5) || Math.abs(z - CROSSING.z) < CROSSING.half + 1) continue;
    g.add(at(tree(1.9, greens[i++ % 3]), -1.85, z));
  }
  const car = mat('#b8322e', { roughness: 0.3, metalness: 0.4 });
  const glass = mat('#2d3642', { roughness: 0.1, metalness: 0.5 });
  const tire = mat('#1d1e20', { roughness: 0.9 });
  for (const [z, paintMat] of [
    [-13, car],
    [-44, mat('#e7e8ea', { roughness: 0.3, metalness: 0.4 })]
  ] as const) {
    const c = new THREE.Group();
    c.add(mesh(rounded(1.8, 0.62, 4.2, 0.2), paintMat, 0, 0.58, 0));
    c.add(mesh(rounded(1.6, 0.55, 2.2, 0.22), glass, 0, 1.1, -0.2));
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      const w = mesh(cyl(0.33, 0.33, 0.24, 18), tire, sx * 0.82, 0.33, sz * 1.35);
      w.rotation.z = Math.PI / 2;
      c.add(w);
    }
    g.add(at(c, ROAD.x1 - 1.2, z));
  }
}

/** 電柱と電線。足もとは黄色と黒の縞の巻きもの */
function poles(g: THREE.Group) {
  const pole = mat('#a8a79f', { roughness: 0.85 });
  const stripes = paint(16, 64, (c) => {
    for (let y = -16; y < 64; y += 16) {
      c.fillStyle = '#e8c21e';
      c.fillRect(0, y, 16, 8);
      c.fillStyle = '#1f1f1f';
      c.fillRect(0, y + 8, 16, 8);
    }
  });
  const guard = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
  const wire = mat('#2a2a2a', { roughness: 0.8 });
  const zs = [BACK, ...POLES, -LENGTH - 10];
  for (const z of POLES) {
    g.add(mesh(cyl(0.1, 0.15, 9, 14), pole, POLE_X, 4.5, z));
    g.add(mesh(cyl(0.165, 0.165, 1.1, 14), guard, POLE_X, 0.55, z));
    g.add(mesh(box(1.3, 0.09, 0.09), pole, POLE_X, 8.3, z, false));
    // 歩道の側へ腕をのばした街灯
    g.add(mesh(box(1.1, 0.06, 0.06), pole, POLE_X + 0.55, 5.2, z, false));
    g.add(mesh(box(0.42, 0.08, 0.2), pole, POLE_X + 1.1, 5.16, z, false));
    g.add(mesh(box(0.36, 0.05, 0.15), lampGlass, POLE_X + 1.1, 5.1, z, false));
    g.add(pool(POLE_X + 1.6, z, 2.4));
  }
  for (let i = 1; i < zs.length; i++) {
    const len = zs[i - 1] - zs[i];
    for (const dx of [-0.55, 0, 0.55]) {
      const w = mesh(cyl(0.009, 0.009, len, 4), wire, POLE_X + dx, 8.38, zs[i] + len / 2, false);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  }
}

/** 赤い地上式の消火栓 */
function hydrant() {
  const h = new THREE.Group();
  const red = mat('#c42a26', { roughness: 0.45 });
  h.add(mesh(cyl(0.14, 0.15, 0.05, 18), red, 0, 0.085, 0));
  h.add(mesh(cyl(0.09, 0.1, 0.52, 18), red, 0, 0.36, 0));
  const cap = mesh(sphere(0.1, 18, 10), red, 0, 0.62, 0);
  cap.scale.y = 0.6;
  h.add(cap);
  h.add(mesh(cyl(0.025, 0.03, 0.06, 10), red, 0, 0.69, 0));
  for (const s of [-1, 1]) {
    const out = mesh(cyl(0.045, 0.045, 0.1, 12), red, s * 0.12, 0.44, 0);
    out.rotation.z = Math.PI / 2;
    h.add(out);
  }
  return h;
}

/** 道の先の公園の入口。石の門柱と看板、生け垣、その奥の芝と木 */
function entrance(g: THREE.Group) {
  const stone = mat('#b9ad9a', { roughness: 0.9 });
  const z = -LENGTH;
  for (const x of [SIDEWALK.x0 - 0.3, SIDEWALK.x1 + 0.05]) g.add(mesh(rounded(0.5, 1.5, 0.5, 0.05), stone, x, 0.75, z));
  const sign = paint(512, 128, (c) => {
    c.fillStyle = '#6b4a2e';
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#fff8e8';
    c.font = 'bold 76px "Hiragino Maru Gothic ProN", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('こうえん', 256, 68);
  });
  const board = mesh(box(2.6, 0.62, 0.08), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }), -0.1, 2, z);
  g.add(board);
  for (const x of [SIDEWALK.x0 - 0.3, SIDEWALK.x1 + 0.05]) g.add(mesh(box(0.1, 0.5, 0.1), stone, x, 1.6, z));
  const hedge = new THREE.MeshStandardMaterial({ color: '#4a7433', map: foliage(41), roughness: 0.95 });
  g.add(mesh(rounded(38, 0.8, 0.7, 0.2), hedge, SIDEWALK.x0 - 0.6 - 19, 0.4, z, false));
  g.add(mesh(rounded(0.7, 0.8, 28, 0.2), hedge, SIDEWALK.x1 + 0.1, 0.4, z - 14.5, false));
  const path = textured('#e4e1da', concrete(), 2, 12);
  g.add(mesh(box(2, 0.03, 26), path, -0.1, 0.02, z - 13, false));
  const greens = [leaf('#5d8a3e'), leaf('#4b7634'), leaf('#c79aad')];
  for (let i = 0; i < 10; i++)
    g.add(at(tree(1.6 + (i % 3) * 0.35, greens[i % 3]), -3 - (i % 5) * 4, z - 4 - (i % 2) * 7 - i));
  for (const x of [-4.5, 3.2 - 7]) g.add(at(bench(), x, z - 9, 0));
}

/** うんち。こげ茶の 3 段のうずまき */
function poopModel() {
  const g = new THREE.Group();
  const brown = mat('#5e3b1f', { roughness: 0.35 });
  for (const [r, y] of [
    [0.04, 0.02],
    [0.031, 0.05],
    [0.02, 0.074]
  ])
    g.add(mesh(sphere(r, 12, 8), brown, 0, y, 0));
  g.scale.y = 0.85;
  return g;
}

/** 材質と影の有無ごとに、動かない形を 1 つにまとめる */
function bake(src: THREE.Group): THREE.Group {
  src.updateMatrixWorld(true);
  const buckets = new Map<string, { m: THREE.Material; cast: boolean; parts: THREE.BufferGeometry[] }>();
  src.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const geom: THREE.BufferGeometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geom.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(geom.attributes))
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geom.deleteAttribute(k);
    const key = `${o.material.uuid}:${o.castShadow}:${Object.keys(geom.attributes).sort().join()}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { m: o.material, cast: o.castShadow, parts: [] }));
    b.parts.push(geom);
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.parts), b.m);
    for (const p of b.parts) p.dispose();
    m.castShadow = b.cast;
    m.receiveShadow = true;
    out.add(m);
  }
  // まとめる前の形のうち、共有していない（mat・geo で作っていない）ものを捨てる。材質はまとめた形が使いつづける
  src.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose();
  });
  return out;
}
