import * as THREE from 'three';
import type { Built, Follow } from './activity';
import type { Layout } from './layout';
import { box, cyl, geo, mat, mesh, sphere, torus } from './props';
import { release, rounded } from './scenes';
import { fabric, paint, plaster, seeded } from './textures';

/**
 * おふろ場。タイルの洗い場の手前に金だらいを置き、ペットはその中に立つ。奥の壁ぎわに浴槽、
 * 左に水栓・鏡・シャワー、タオル掛け。指で持つ道具（スポンジ・シャワー・タオル）とお湯の粒は進行（bath.svelte.ts）が動かす
 */
export type HandTool = 'sponge' | 'shower' | 'towel';

export interface Bathroom extends Built {
  /** 指の下の、ペットの体の高さの点に道具を出す。null で隠す（シャワーは壁の掛け具へ戻る） */
  hand(tool: HandTool | null, at: THREE.Vector3 | null): void;
  /** シャワーのお湯が止まる高さ（当たった体の上か、たらいの水面） */
  pour(stopY: number): void;
}

// 水は足先がつかるくらい。深いとおすわりした子の腰まで沈んで見える
export const TUB = { x: 0, z: 0.35, r: 0.44, water: 0.035 };
const WALL = { back: -1.7, side: 1.3, front: 2.4, height: 2.4, tiles: 1.25 };
// 部屋の映り込みを控えめにしているので、金属はそのぶん映り込みを強めないと黒ずむ
const CHROME = { color: '#f4f6f8', metal: { metalness: 0.9, roughness: 0.18, envMapIntensity: 2.6 } };
const HEAD_ABOVE = new THREE.Vector3(0.02, 0.2, 0.05);
const DROPS = 360;

export const BATH: Layout = {
  bounds: { x0: TUB.x - 0.3, x1: TUB.x + 0.3, z0: TUB.z - 0.3, z1: TUB.z + 0.3 },
  front: { x: TUB.x, z: TUB.z },
  blocks: [],
  camera: { x: 0.3, y: 1.1, z: 2.05, lookX: 0, lookY: 0.2, lookZ: 0.05, fov: 40 }
};
export const BATH_FOLLOW: Follow = { x: 0.35, zMin: 1.9, zMax: 2.2, near: 1.2, rate: 1.4, shadow: 1.8 };

export function buildBath(): Bathroom {
  const group = new THREE.Group();
  group.add(floor(), ...walls(), bathtub(), washWall(), towelBar(), tarai(), stool(), oke());
  const tools = { sponge: sponge(), shower: showerHead(), towel: towel() };
  for (const t of Object.values(tools)) {
    t.visible = false;
    group.add(t);
  }
  // 壁の掛け具にかかったシャワー。手に持つあいだは隠す
  const rest = showerHead();
  rest.position.set(-0.2, 1.62, WALL.back + 0.07);
  rest.rotation.x = -0.5;
  group.add(rest);
  const mixer = new THREE.Vector3(-0.55, 0.6, WALL.back + 0.08);
  const hose = new THREE.Mesh(hoseGeometry(mixer, rest.position), mat('#d7d9dc', { roughness: 0.3, metalness: 0.6 }));
  hose.castShadow = true;
  group.add(hose);
  const water = drops();
  group.add(water.points);

  let holding: HandTool | null = null;
  const lastHead = rest.position.clone();
  return {
    group,
    dispose() {
      hose.geometry.dispose();
      release(group);
    },
    update: (dt) => water.step(dt, holding === 'shower' ? tools.shower.position : null),
    hand(tool, at) {
      holding = at ? tool : null;
      for (const [k, t] of Object.entries(tools)) t.visible = k === holding;
      rest.visible = holding !== 'shower';
      const head = holding === 'shower' ? tools.shower.position : rest.position;
      if (at && holding) {
        const t = tools[holding];
        t.position.copy(at);
        if (holding === 'shower') t.position.add(HEAD_ABOVE);
      }
      // ponytail: ホースは 4cm 動くごとに形を作り直す。重ければ骨で曲げる管にする
      if (head.distanceTo(lastHead) < 0.04) return;
      lastHead.copy(head);
      hose.geometry.dispose();
      hose.geometry = hoseGeometry(mixer, head);
    },
    pour: (y) => (water.stop = y)
  };
}

/** 10cm 角の床タイル。1 枚ずつ明るさを散らし、目地を暗く */
function tileMap(n: number, base: [number, number, number], vary: number, grout: string, seed: number) {
  const rnd = seeded(seed);
  const S = 512;
  const step = S / n;
  return paint(
    S,
    S,
    (g) => {
      g.fillStyle = grout;
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const k = 1 + (rnd() - 0.5) * vary;
          g.fillStyle = `rgb(${base.map((c) => Math.min(255, c * k)).join(' ')})`;
          g.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
          // タイルの面のゆるいつやむら
          g.fillStyle = `rgb(255 255 255 / ${0.05 + rnd() * 0.06})`;
          g.fillRect(x * step + 4, y * step + 4, (step - 8) * rnd(), step - 8);
        }
    },
    true
  );
}

function floor() {
  const w = WALL.side * 2;
  const d = WALL.front - WALL.back;
  const map = tileMap(12, [196, 188, 176], 0.12, '#8d8579', 5);
  map.repeat.set(w / 1.2, d / 1.2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map, roughness: 0.35 }));
  m.rotation.x = -Math.PI / 2;
  m.position.z = (WALL.back + WALL.front) / 2;
  m.receiveShadow = true;
  return m;
}

function walls() {
  const d = WALL.front - WALL.back;
  const tiles = (w: number) => {
    const map = tileMap(8, [236, 240, 242], 0.05, '#b9c0c4', 9);
    map.repeat.set(w / 1.2, WALL.tiles / 1.2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.18 });
  };
  const upper = plaster();
  const top = new THREE.MeshStandardMaterial({ color: '#dfe9ee', map: upper, roughness: 0.9 });
  const out: THREE.Mesh[] = [];
  const add = (w: number, x: number, z: number, ry: number) => {
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL.tiles), tiles(w));
    low.position.set(x, WALL.tiles / 2, z);
    const high = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL.height - WALL.tiles), top);
    high.position.set(x, (WALL.height + WALL.tiles) / 2, z);
    for (const m of [low, high]) {
      m.rotation.y = ry;
      m.receiveShadow = true;
      out.push(m);
    }
  };
  add(WALL.side * 2, 0, WALL.back, 0);
  for (const s of [-1, 1]) add(d, s * WALL.side, (WALL.back + WALL.front) / 2, -s * (Math.PI / 2));
  // タイルと上の壁の見切り
  out.push(mesh(box(WALL.side * 2, 0.03, 0.02), '#f2f4f5', 0, WALL.tiles, WALL.back + 0.01, false));
  return out;
}

function bathtub() {
  const g = new THREE.Group();
  const acrylic = mat('#f6f7f8', { roughness: 0.2 });
  const [w, d, h, t] = [1.15, 0.75, 0.52, 0.07];
  g.add(mesh(rounded(w, h, d, 0.05), acrylic, 0, h / 2, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(rounded(w, 0.05, t, 0.02), acrylic, 0, h + 0.02, (s * (d - t)) / 2));
    g.add(mesh(rounded(t, 0.05, d, 0.02), acrylic, (s * (w - t)) / 2, h + 0.02, 0));
  }
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w - t * 2, d - t * 2),
    new THREE.MeshStandardMaterial({
      color: '#8fd0e8',
      roughness: 0.05,
      transparent: true,
      opacity: 0.75,
      envMapIntensity: 1.6
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = h + 0.012;
  g.add(water);
  // 浴槽のふたを奥に半分だけ巻いて置く
  g.add(mesh(rounded(w - 0.02, 0.18, 0.2, 0.08), mat('#e9edf0', { roughness: 0.45 }), 0, h + 0.13, -d / 2 + 0.12));
  g.position.set(WALL.side - w / 2, 0, WALL.back + d / 2);
  return g;
}

/** 洗い場の壁。水栓・棚とボトル・鏡・シャワーの掛け具のバー */
function washWall() {
  const g = new THREE.Group();
  const chrome = mat(CHROME.color, CHROME.metal);
  const z = WALL.back;
  g.add(mesh(rounded(0.26, 0.07, 0.07, 0.02), chrome, -0.55, 0.6, z + 0.04));
  const spout = mesh(cyl(0.012, 0.012, 0.14, 12), chrome, -0.55, 0.57, z + 0.1);
  spout.rotation.x = Math.PI / 2;
  g.add(spout);
  for (const s of [-1, 1]) g.add(mesh(cyl(0.028, 0.028, 0.035, 18), chrome, -0.55 + s * 0.16, 0.6, z + 0.05));
  // 棚とシャンプーのボトル
  g.add(mesh(rounded(0.5, 0.02, 0.12, 0.008), mat('#f3f4f5', { roughness: 0.3 }), -0.55, 0.82, z + 0.06));
  const bottles: [string, number, number][] = [
    ['#f4a8bb', -0.72, 0.16],
    ['#9fd3c7', -0.6, 0.19],
    ['#fbe39a', -0.47, 0.13]
  ];
  for (const [color, x, h] of bottles) {
    g.add(mesh(capsuleBody(h), mat(color, { roughness: 0.35 }), x, 0.83 + h / 2, z + 0.06));
    g.add(mesh(cyl(0.012, 0.016, 0.03, 10), mat('#ffffff', { roughness: 0.4 }), x, 0.84 + h, z + 0.06));
  }
  // 鏡。部屋の映り込みでそれらしく光らせる
  const mirror = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.66),
    new THREE.MeshStandardMaterial({ color: '#dfe7ea', metalness: 1, roughness: 0.04, envMapIntensity: 1.4 })
  );
  mirror.position.set(-0.6, 1.3, z + 0.008);
  g.add(mirror, mesh(rounded(0.5, 0.7, 0.012, 0.004), chrome, -0.6, 1.3, z + 0.002, false));
  const bar = mesh(cyl(0.012, 0.012, 1, 12), chrome, -0.2, 1.35, z + 0.045);
  g.add(bar);
  for (const y of [0.85, 1.85]) g.add(mesh(cyl(0.02, 0.02, 0.05, 12), chrome, -0.2, y, z + 0.03));
  const hook = mesh(cyl(0.02, 0.02, 0.05, 12), chrome, -0.2, 1.62, z + 0.05);
  hook.rotation.x = Math.PI / 2;
  g.add(hook);
  return g;
}

const capsuleBody = (h: number) =>
  geo(`bottle:${h}`, () => new THREE.CapsuleGeometry(0.03, h - 0.06, 6, 14).scale(1, 1, 0.75));

function towelBar() {
  const g = new THREE.Group();
  const chrome = mat(CHROME.color, CHROME.metal);
  const bar = mesh(cyl(0.01, 0.01, 0.5, 12), chrome, 0, 0, 0.06);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const arm = mesh(cyl(0.012, 0.012, 0.06, 10), chrome, s * 0.25, 0, 0.03);
    arm.rotation.x = Math.PI / 2;
    g.add(arm);
  }
  const cloth = towelMat('#9cc8e8');
  // 棒に掛けて前後に垂れたタオル。角を丸めた薄い板 2 枚で折り目を作る
  g.add(mesh(rounded(0.4, 0.5, 0.018, 0.008), cloth, 0, -0.24, 0.075));
  g.add(mesh(rounded(0.4, 0.42, 0.018, 0.008), cloth, 0, -0.2, 0.048));
  g.add(mesh(cyl(0.02, 0.02, 0.4, 12), cloth, 0, 0.005, 0.062).rotateZ(Math.PI / 2));
  g.position.set(-1.0, 1.05, WALL.back);
  return g;
}

const towelMat = (color: string) => {
  const map = fabric(23).clone();
  map.repeat.set(3, 3);
  return new THREE.MeshPhysicalMaterial({ color, map, roughness: 1, sheen: 0.8, sheenRoughness: 0.8 });
};

/** 金だらい。底から口へ広がる回転体に、巻いたふち */
function tarai() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: '#c3c8cc',
    metalness: 0.85,
    roughness: 0.32,
    side: THREE.DoubleSide
  });
  const r = TUB.r;
  const pts = [
    [0, 0.004],
    [r * 0.8, 0.004],
    [r * 0.84, 0.03],
    [r * 0.9, 0.08],
    [r * 0.97, 0.12],
    [r, 0.135]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), metal);
  body.castShadow = body.receiveShadow = true;
  const rim = mesh(torus(r, 0.008, 8, 64), metal, 0, 0.135, 0);
  rim.rotation.x = Math.PI / 2;
  // 胴の段。金だらいらしい 2 本の筋
  const ridge = (y: number, rr: number) => {
    const m = mesh(torus(rr, 0.004, 6, 64), metal, 0, y, 0, false);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.85, 48),
    new THREE.MeshStandardMaterial({
      color: '#7cc3e3',
      roughness: 0.04,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      envMapIntensity: 1.8
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = TUB.water;
  g.add(body, rim, ridge(0.05, r * 0.865), ridge(0.1, r * 0.93), water);
  g.position.set(TUB.x, 0, TUB.z);
  return g;
}

/** おふろの椅子 */
function stool() {
  const g = new THREE.Group();
  const plastic = mat('#f2d6a8', { roughness: 0.4 });
  g.add(mesh(rounded(0.3, 0.03, 0.22, 0.012), plastic, 0, 0.22, 0));
  for (const s of [-1, 1]) g.add(mesh(rounded(0.03, 0.21, 0.2, 0.01), plastic, s * 0.12, 0.105, 0));
  g.position.set(-0.8, 0, -0.75);
  g.rotation.y = 0.35;
  return g;
}

/** 木の桶。板の筋を縦に描き、たがを 2 本 */
function oke() {
  const g = new THREE.Group();
  const map = paint(256, 64, (c) => {
    const rnd = seeded(31);
    for (let i = 0; i < 16; i++) {
      const v = 190 + rnd() * 30;
      c.fillStyle = `rgb(${v} ${v * 0.8} ${v * 0.55})`;
      c.fillRect(i * 16, 0, 16, 64);
      c.fillStyle = 'rgb(90 60 30 / 0.4)';
      c.fillRect(i * 16, 0, 1, 64);
    }
  });
  const wood = new THREE.MeshStandardMaterial({ map, roughness: 0.7, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.13, 32, 1, true), wood);
  body.position.y = 0.065;
  body.castShadow = true;
  const bottom = mesh(cyl(0.11, 0.11, 0.01, 32), wood, 0, 0.012, 0);
  const brass = mat('#b88a3e', { metalness: 0.8, roughness: 0.35 });
  const hoops = [0.03, 0.1].map((y) => {
    const m = mesh(torus(0.115 + y * 0.14, 0.004, 6, 48), brass, 0, y, 0, false);
    m.rotation.x = Math.PI / 2;
    return m;
  });
  g.add(body, bottom, ...hoops);
  g.position.set(-0.45, 0, -0.95);
  return g;
}

function sponge() {
  const g = new THREE.Group();
  g.add(mesh(rounded(0.1, 0.045, 0.065, 0.015), mat('#f5cd4c', { roughness: 0.95 })));
  g.add(mesh(rounded(0.1, 0.012, 0.065, 0.005), mat('#5aa35a', { roughness: 0.9 }), 0, 0.026, 0));
  for (let i = 0; i < 5; i++)
    g.add(mesh(sphere(0.012 + (i % 2) * 0.006, 10, 8), mat('#ffffff', { roughness: 0.3 }), (i - 2) * 0.02, 0.035, 0));
  g.rotation.y = 0.4;
  return g;
}

/** 手に持つシャワー。下を向いた丸い頭と、斜め上へ出る柄 */
function showerHead() {
  const g = new THREE.Group();
  const chrome = mat(CHROME.color, CHROME.metal);
  g.add(mesh(cyl(0.045, 0.038, 0.025, 28), chrome));
  g.add(mesh(cyl(0.037, 0.037, 0.004, 28), mat('#f2f2f0', { roughness: 0.5 }), 0, -0.013, 0, false));
  const handle = mesh(cyl(0.014, 0.012, 0.2, 14), chrome, 0, 0.08, 0.09);
  handle.rotation.x = 0.95;
  g.add(handle);
  return g;
}

function towel() {
  const g = new THREE.Group();
  const cloth = towelMat('#f7b7c6');
  g.add(mesh(rounded(0.16, 0.05, 0.11, 0.022), cloth));
  g.add(mesh(rounded(0.15, 0.03, 0.1, 0.014), cloth, 0.01, 0.035, 0.005));
  g.rotation.y = -0.3;
  return g;
}

function hoseGeometry(from: THREE.Vector3, to: THREE.Vector3) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.min(from.y, to.y) - 0.35;
  const curve = new THREE.CatmullRomCurve3([from, from.clone().add(new THREE.Vector3(0, -0.12, 0.05)), mid, to]);
  return new THREE.TubeGeometry(curve, 40, 0.009, 6);
}

/** シャワーのお湯の粒。頭の下から出て、落ちて stop の高さで消える */
function drops() {
  const pos = new Float32Array(DROPS * 3).fill(-10);
  const vel = new Float32Array(DROPS * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = paint(32, 32, (c) => {
    const r = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgb(255 255 255 / 1)');
    r.addColorStop(0.5, 'rgb(230 245 255 / 0.7)');
    r.addColorStop(1, 'rgb(230 245 255 / 0)');
    c.fillStyle = r;
    c.fillRect(0, 0, 32, 32);
  });
  const points = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      map: dot,
      color: '#bfe4ff',
      size: 0.02,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  points.frustumCulled = false;
  let next = 0;
  let owed = 0;
  const state = {
    points,
    stop: TUB.water,
    step(dt: number, head: THREE.Vector3 | null) {
      owed += head ? dt * 600 : 0;
      for (; owed >= 1; owed--) {
        const i = next;
        next = (next + 1) % DROPS;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.034;
        pos.set([head!.x + Math.cos(a) * d, head!.y - 0.016, head!.z + Math.sin(a) * d], i * 3);
        vel.set([Math.cos(a) * d * 3, -1.6 - Math.random() * 0.4, Math.sin(a) * d * 3], i * 3);
      }
      for (let i = 0; i < DROPS; i++) {
        if (pos[i * 3 + 1] < -1) continue;
        vel[i * 3 + 1] -= 9.8 * dt;
        for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
        if (pos[i * 3 + 1] < state.stop) pos[i * 3 + 1] = -10;
      }
      g.attributes.position.needsUpdate = true;
    }
  };
  return state;
}
