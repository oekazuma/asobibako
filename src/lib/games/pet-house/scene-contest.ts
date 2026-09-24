import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Built } from './activity';
import { ARENA, COURSE, POLES, TUNNEL, type Gate } from './contest';
import { box, capsule, cyl, geo, mat, mesh, sphere, torus } from './props';
import { blades, release, rounded, skyDome, tree } from './scenes';
import { lawn, paint, seeded } from './textures';

/**
 * コンテストの会場。芝のグラウンドを広告板のフェンスで囲み、奥に観客席、上に旗。
 * アジリティの道具（course）と次の門の目印（mark）は、進行（contest-play.svelte.ts）が出し入れする
 */
export interface Venue extends Built {
  course(): void;
  mark(gate: Gate | null): void;
  /** 観客が跳ねて喜ぶ強さ 0..1。だんだん静まる */
  cheer(power: number): void;
  /** 審判の立つ位置と、向く点 */
  judge(x: number, z: number, lookX: number, lookZ: number): void;
  /** 審判が手を上げて芸を言う */
  call(on: boolean): void;
}

const FIELD = { x: 4.1, back: -12, front: 1.8 };
const STAND = { z: -13.2, rows: 7, step: 0.8, rise: 0.42, width: 17 };
const WHITE = '#f3f2ea';

export function buildContest(): Venue {
  const group = new THREE.Group();
  const updates: ((dt: number, t: number) => void)[] = [];
  group.add(ground(), skyDome(), blades(), ...lines(), ...fence());
  const crowd = stands(group);
  updates.push(crowd.update);
  for (const f of flags(group)) updates.push(f);

  const leaf = (color: string) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9 });
  const greens = [leaf('#5d8a3e'), leaf('#4b7634')];
  for (let i = 0; i < 9; i++) {
    const t = tree(1.5 + (i % 3) * 0.3, greens[i % 2], false);
    t.position.set(-16 + i * 4, 0, -22 - (i % 2) * 2);
    group.add(t);
  }

  const referee = person();
  group.add(referee.group);
  let calling = 0;
  updates.push((dt) => {
    calling += ((referee.on ? 1 : 0) - calling) * Math.min(1, dt * 10);
    referee.arm.rotation.z = 0.15 + calling * 2.6;
  });

  let course: THREE.Group | null = null;
  const marker = beacon();
  marker.group.visible = false;
  group.add(marker.group);
  updates.push((_, t) => marker.update(t));

  return {
    group,
    dispose: () => release(group),
    update: (dt, t) => {
      for (const u of updates) u(dt, t);
    },
    course() {
      if (course) return;
      course = agility();
      group.add(course);
    },
    mark(gate) {
      marker.group.visible = !!gate;
      if (!gate) return;
      marker.group.position.set((gate.a.x + gate.b.x) / 2, 0, (gate.a.z + gate.b.z) / 2);
      marker.group.rotation.y = -Math.atan2(gate.b.z - gate.a.z, gate.b.x - gate.a.x);
      marker.setWidth(Math.hypot(gate.b.x - gate.a.x, gate.b.z - gate.a.z));
    },
    cheer: (power) => crowd.cheer(power),
    judge(x, z, lookX, lookZ) {
      referee.group.position.set(x, 0, z);
      referee.group.rotation.y = Math.atan2(lookX - x, lookZ - z);
    },
    call(on) {
      referee.on = on;
    }
  };
}

/** 芝のグラウンド。刈った向きで明るさの違う帯を重ねる */
function ground() {
  const g = new THREE.Group();
  const grass = lawn();
  grass.repeat.set(60 / 3, 60 / 3);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -10;
  floor.receiveShadow = true;
  const bands = paint(8, 64, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 8, 64);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 8, 32);
  });
  const w = FIELD.x * 2;
  const d = FIELD.front - FIELD.back;
  bands.repeat.set(1, d / 3);
  bands.wrapS = bands.wrapT = THREE.RepeatWrapping;
  bands.colorSpace = THREE.NoColorSpace;
  const mow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color: '#cfe8a0',
      alphaMap: bands,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    })
  );
  mow.rotation.x = -Math.PI / 2;
  mow.position.set(0, 0.004, (FIELD.front + FIELD.back) / 2);
  mow.receiveShadow = true;
  g.add(floor, mow);
  return g;
}

/** front から 2m ごとの白線と距離の数字。フリスビーがどれだけ飛んだか見てわかるように */
function lines() {
  const paintMat = mat(WHITE, { roughness: 0.9 });
  const out: THREE.Object3D[] = [];
  for (let m = 2; m <= 10; m += 2) {
    const z = ARENA.front.z - m;
    out.push(mesh(box(ARENA.bounds.x1 * 2, 0.006, 0.05), paintMat, 0, 0.003, z, false));
    for (const s of [-1, 1]) {
      const label = new THREE.Mesh(
        geo('distance-label', () => new THREE.PlaneGeometry(0.6, 0.3)),
        new THREE.MeshStandardMaterial({ map: digits(`${m}m`), transparent: true, roughness: 0.9, depthWrite: false })
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(s * (ARENA.bounds.x1 - 0.45), 0.006, z + 0.25);
      label.receiveShadow = true;
      out.push(label);
    }
  }
  return out;
}

function digits(text: string) {
  return paint(128, 64, (c) => {
    c.fillStyle = WHITE;
    c.font = 'bold 50px "Hiragino Maru Gothic ProN", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 64, 34);
  });
}

/** 広告板のフェンス。架空の大会の名前と足あとの模様 */
function fence() {
  const map = paint(1024, 128, (c) => {
    const panels = ['#2f6fd6', '#f7f4ec', '#e8483f', '#f7f4ec'];
    panels.forEach((color, i) => {
      c.fillStyle = color;
      c.fillRect(i * 256, 0, 256, 128);
    });
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'bold 44px "Hiragino Maru Gothic ProN", sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText('わんにゃん', 128, 64);
    c.fillText('カップ', 640, 64);
    for (const x0 of [256, 768]) {
      c.fillStyle = x0 === 256 ? '#2f6fd6' : '#e8483f';
      for (let k = 0; k < 3; k++) paw(c, x0 + 50 + k * 78, 64 + (k % 2 ? -18 : 18), 18);
    }
  });
  map.wrapS = THREE.RepeatWrapping;
  const out: THREE.Object3D[] = [];
  const board = (len: number, x: number, z: number, turn: number) => {
    const m = map.clone();
    m.repeat.set(len / 8, 1);
    m.needsUpdate = true;
    const face = new THREE.MeshStandardMaterial({ map: m, roughness: 0.6 });
    // scenes の release() は材質の配列を扱わないので、ふちも同じ絵の材質 1 つで塗る（厚み 6cm なので目立たない）
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.75, 0.06), face);
    b.position.set(x, 0.375, z);
    b.rotation.y = turn;
    b.castShadow = b.receiveShadow = true;
    out.push(b);
  };
  const len = FIELD.front - FIELD.back;
  board(FIELD.x * 2, 0, FIELD.back, 0);
  board(len, -FIELD.x, (FIELD.front + FIELD.back) / 2, Math.PI / 2);
  board(len, FIELD.x, (FIELD.front + FIELD.back) / 2, -Math.PI / 2);
  return out;
}

function paw(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.ellipse(x, y + r * 0.35, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
  for (const [dx, dy] of [
    [-0.75, -0.45],
    [-0.28, -0.85],
    [0.28, -0.85],
    [0.75, -0.45]
  ]) {
    c.moveTo(x + dx * r + r * 0.25, y + dy * r);
    c.arc(x + dx * r, y + dy * r, r * 0.25, 0, Math.PI * 2);
  }
  c.fill();
}

/**
 * 奥の観客席。段と座席は形 1 つずつ、観客は体と頭をそれぞれ 1 つの InstancedMesh にして、
 * 喜ぶときは行列だけを書き換える
 */
function stands(group: THREE.Group) {
  const concrete = mat('#b9b6ae', { roughness: 0.95 });
  const seat = mat('#2f6fd6', { roughness: 0.5 });
  for (let i = 0; i < STAND.rows; i++) {
    const h = 0.5 + i * STAND.rise;
    const z = STAND.z - i * STAND.step;
    group.add(mesh(box(STAND.width, h, STAND.step), concrete, 0, h / 2, z - STAND.step / 2, false));
    group.add(mesh(box(STAND.width, 0.08, 0.3), seat, 0, h + 0.04, z - STAND.step + 0.2, false));
  }
  const top = 0.5 + (STAND.rows - 1) * STAND.rise;
  const backZ = STAND.z - STAND.rows * STAND.step;
  group.add(mesh(box(STAND.width, 1.1, 0.1), mat('#8d8a82'), 0, top + 0.55, backZ, false));

  const rnd = seeded(53);
  const spots: { x: number; y: number; z: number; phase: number; size: number; arms: boolean }[] = [];
  for (let i = 0; i < STAND.rows; i++)
    for (let x = -STAND.width / 2 + 0.4; x < STAND.width / 2 - 0.3; x += 0.5 + rnd() * 0.3) {
      if (rnd() < 0.2) continue;
      spots.push({
        x: x + (rnd() - 0.5) * 0.1,
        y: 0.5 + i * STAND.rise + 0.08,
        z: STAND.z - i * STAND.step - STAND.step + 0.24,
        phase: rnd() * 6,
        // 子どもまじりに見えるよう大きさを散らす
        size: rnd() < 0.15 ? 0.72 : 0.9 + rnd() * 0.18,
        arms: rnd() < 0.6
      });
    }
  const n = spots.length;
  const cloth = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const bodies = new THREE.InstancedMesh(capsule(0.13, 0.26), cloth, n);
  const heads = new THREE.InstancedMesh(sphere(0.095, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const hair = new THREE.InstancedMesh(
    geo('crowd-hair', () => new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    n
  );
  const arms = new THREE.InstancedMesh(capsule(0.035, 0.24), cloth, n * 2);
  const shirts = [
    '#e8483f',
    '#f2b134',
    '#2f6fd6',
    '#f7f4ec',
    '#3aa66b',
    '#8e5bd6',
    '#f08ab0',
    '#34495e',
    '#7b8a99'
  ].map((c) => new THREE.Color(c));
  const skins = ['#f2d0b0', '#e3b48e', '#c98f66', '#a8704b'].map((c) => new THREE.Color(c));
  const hairs = ['#2a211c', '#3b2a1e', '#5a3c26', '#1c1c1c', '#8f8a84', '#b98b4e'].map((c) => new THREE.Color(c));
  spots.forEach((_, i) => {
    const shirt = shirts[Math.floor(rnd() * shirts.length)];
    bodies.setColorAt(i, shirt);
    arms.setColorAt(i * 2, shirt);
    arms.setColorAt(i * 2 + 1, shirt);
    heads.setColorAt(i, skins[Math.floor(rnd() * skins.length)]);
    hair.setColorAt(i, hairs[Math.floor(rnd() * hairs.length)]);
  });
  const o = new THREE.Object3D();
  const arm = new THREE.Object3D();
  let excite = 0;
  const place = (t: number) => {
    spots.forEach((s, i) => {
      const beat = Math.max(0, Math.sin(t * 9 + s.phase));
      const hop = excite * beat * 0.16 + 0.008 * Math.sin(t * 1.3 + s.phase);
      o.position.set(s.x, s.y + (0.27 + hop) * s.size, s.z);
      // 肩はばを出すため、体を横に広げて前後につぶす
      o.scale.set(s.size * 1.3, s.size, s.size * 0.85);
      o.updateMatrix();
      bodies.setMatrixAt(i, o.matrix);
      o.scale.setScalar(s.size);
      o.position.y += 0.33 * s.size;
      o.updateMatrix();
      heads.setMatrixAt(i, o.matrix);
      o.position.y += 0.012 * s.size;
      o.updateMatrix();
      hair.setMatrixAt(i, o.matrix);
      // 喜ぶときは手を上げて振る。手を上げない人もまぜる
      const up = s.arms ? Math.min(1, excite * 1.6) : 0;
      for (const side of [-1, 1]) {
        arm.position.set(s.x + side * 0.19 * s.size, s.y + (0.4 + hop) * s.size, s.z);
        arm.rotation.set(0, 0, side * (0.15 + up * (2.5 + 0.3 * Math.sin(t * 12 + s.phase))));
        arm.scale.setScalar(s.size);
        arm.translateY(-0.12 * s.size);
        arm.updateMatrix();
        arms.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), arm.matrix);
      }
    });
    for (const m of [bodies, heads, hair, arms]) m.instanceMatrix.needsUpdate = true;
  };
  place(0);
  group.add(bodies, heads, hair, arms);
  return {
    cheer: (power: number) => (excite = Math.max(excite, power)),
    update: (dt: number, t: number) => {
      excite = Math.max(0, excite - dt * 0.35);
      place(t);
    }
  };
}

/** 観客席の上の旗と、旗をつないだ三角の飾り。旗は毎フレーム頂点を波打たせる */
function flags(group: THREE.Group) {
  const top = 0.5 + (STAND.rows - 1) * STAND.rise + 1.1;
  const z = STAND.z - STAND.rows * STAND.step;
  const colors = ['#e8483f', '#f2b134', '#2f6fd6', '#3aa66b', '#f08ab0'];
  const waves: ((dt: number, t: number) => void)[] = [];
  const xs = [-7.5, -3.75, 0, 3.75, 7.5];
  xs.forEach((x, i) => {
    group.add(
      mesh(cyl(0.03, 0.03, 2.6, 8), mat('#e9e9e9', { metalness: 0.6, roughness: 0.3 }), x, top + 1.3, z, false)
    );
    const cloth = new THREE.PlaneGeometry(1, 0.62, 10, 1);
    const flag = new THREE.Mesh(
      cloth,
      new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.8, side: THREE.DoubleSide })
    );
    flag.position.set(x + 0.5, top + 2.25, z);
    group.add(flag);
    const base = cloth.attributes.position.array.slice();
    const p = cloth.attributes.position;
    waves.push((_, t) => {
      for (let k = 0; k < p.count; k++) {
        const u = base[k * 3] + 0.5;
        p.setZ(k, Math.sin(u * 5 - t * 6 + i) * 0.09 * u);
      }
      p.needsUpdate = true;
      cloth.computeVertexNormals();
    });
  });
  // 旗ざおのあいだに垂れた三角の飾り
  const parts: THREE.BufferGeometry[] = [];
  const tint: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < xs.length - 1; i++)
    for (let k = 0; k < 12; k++) {
      const u = (k + 0.5) / 12;
      const x = xs[i] + (xs[i + 1] - xs[i]) * u;
      const y = top + 2.4 - Math.sin(Math.PI * u) * 0.7;
      const tri = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - 0.13, y, z + 0.02),
        new THREE.Vector3(x + 0.13, y, z + 0.02),
        new THREE.Vector3(x, y - 0.3, z + 0.02)
      ]);
      parts.push(tri);
      c.set(colors[(i * 12 + k) % colors.length]);
      for (let v = 0; v < 3; v++) tint.push(c.r, c.g, c.b);
    }
  const bunting = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  bunting.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  bunting.computeVertexNormals();
  group.add(
    new THREE.Mesh(
      bunting,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 })
    )
  );
  return waves;
}

/** 審判。紺の上着にぼうし、片手にバインダー。芸を言うときは右手を上げる */
function person() {
  const group = new THREE.Group();
  const trousers = mat('#3b3f4a');
  const coat = mat('#27406e', { roughness: 0.7 });
  const skin = mat('#eac19c', { roughness: 0.6 });
  for (const s of [-1, 1]) {
    group.add(mesh(cyl(0.06, 0.055, 0.82, 12), trousers, s * 0.09, 0.41, 0));
    group.add(mesh(rounded(0.11, 0.07, 0.24, 0.03), '#2a2622', s * 0.09, 0.035, 0.04));
  }
  group.add(mesh(capsule(0.19, 0.42), coat, 0, 1.13, 0));
  group.add(mesh(cyl(0.05, 0.06, 0.1, 10), skin, 0, 1.5, 0));
  group.add(mesh(sphere(0.12, 20, 16), skin, 0, 1.65, 0.01));
  group.add(mesh(cyl(0.125, 0.13, 0.08, 20), '#f3f2ea', 0, 1.74, 0));
  const brim = mesh(cyl(0.2, 0.2, 0.012, 24), '#f3f2ea', 0, 1.705, 0.04);
  group.add(brim);
  const armL = new THREE.Group();
  armL.position.set(-0.22, 1.38, 0);
  armL.add(mesh(capsule(0.05, 0.42), coat, 0, -0.26, 0));
  armL.rotation.set(-0.9, 0, 0.15);
  armL.add(mesh(box(0.2, 0.28, 0.015), '#c79b62', 0.02, -0.5, 0.06));
  const arm = new THREE.Group();
  arm.position.set(0.22, 1.38, 0);
  arm.add(mesh(capsule(0.05, 0.42), coat, 0, -0.26, 0));
  arm.add(mesh(sphere(0.05), skin, 0, -0.52, 0));
  group.add(armL, arm);
  return { group, arm, on: false };
}

/** 赤白の縞。ハードルのバーとポールに使う */
function stripes() {
  const t = paint(
    16,
    64,
    (c) => {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? '#f6f4ee' : '#e0392f';
        c.fillRect(0, i * 16, 16, 16);
      }
    },
    true
  );
  t.userData.shared = true;
  return t;
}

let striped: THREE.MeshStandardMaterial | null = null;
function stripedMat(repeat: number) {
  striped ??= Object.assign(new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.45 }), {
    userData: { shared: true }
  });
  // clone は userData（shared）まで写すので、写しは release() で捨てられるよう外す
  const m = striped.clone();
  m.userData = {};
  m.map = striped.map!.clone();
  m.map.userData = {};
  m.map.repeat.set(1, repeat);
  m.map.needsUpdate = true;
  return m;
}

function agility() {
  const g = new THREE.Group();
  const white = mat(WHITE, { roughness: 0.5 });
  for (const gate of COURSE) {
    if (gate.kind === 'hurdle') {
      const mid = new THREE.Vector3((gate.a.x + gate.b.x) / 2, 0, (gate.a.z + gate.b.z) / 2);
      const len = Math.hypot(gate.b.x - gate.a.x, gate.b.z - gate.a.z);
      const h = new THREE.Group();
      h.position.copy(mid);
      h.rotation.y = -Math.atan2(gate.b.z - gate.a.z, gate.b.x - gate.a.x);
      for (const s of [-1, 1]) {
        h.add(mesh(cyl(0.025, 0.025, 0.6, 12), white, (s * len) / 2, 0.3, 0));
        h.add(mesh(rounded(0.06, 0.03, 0.4, 0.01), white, (s * len) / 2, 0.015, 0));
      }
      const bar = mesh(cyl(0.017, 0.017, len, 12), stripedMat(len * 4), 0, 0.24, 0);
      bar.rotation.z = Math.PI / 2;
      h.add(bar);
      g.add(h);
    }
  }
  // トンネル。布の筒に針金の輪が等間隔に入った形
  const len = TUNNEL.z1 - TUNNEL.z0;
  const fabric = new THREE.MeshStandardMaterial({ color: '#2f6fd6', roughness: 0.85, side: THREE.DoubleSide });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(TUNNEL.r, TUNNEL.r, len, 28, 1, true), fabric);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(TUNNEL.x, TUNNEL.r - 0.02, (TUNNEL.z0 + TUNNEL.z1) / 2);
  tube.castShadow = tube.receiveShadow = true;
  g.add(tube);
  for (let k = 0; k <= 8; k++) {
    const ring = mesh(
      torus(TUNNEL.r + 0.005, 0.012, 6, 32),
      '#23549f',
      TUNNEL.x,
      TUNNEL.r - 0.02,
      TUNNEL.z0 + (len * k) / 8
    );
    g.add(ring);
  }
  for (const z of POLES.zs) {
    g.add(mesh(cyl(0.02, 0.02, 1, 10), stripedMat(4), POLES.x, 0.5, z));
    g.add(mesh(cyl(0.08, 0.09, 0.03, 16), white, POLES.x, 0.015, z));
  }
  const goal = COURSE[COURSE.length - 1];
  for (const p of [goal.a, goal.b]) g.add(mesh(cyl(0.035, 0.035, 1.5, 12), white, p.x, 0.75, p.z));
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(goal.b.x - goal.a.x, 0.36),
    new THREE.MeshStandardMaterial({ map: goalBanner(), roughness: 0.8, side: THREE.DoubleSide })
  );
  banner.position.set((goal.a.x + goal.b.x) / 2, 1.3, goal.a.z);
  g.add(banner);
  return g;
}

function goalBanner() {
  return paint(512, 128, (c) => {
    for (let x = 0; x < 512; x += 32)
      for (let y = 0; y < 128; y += 32) {
        c.fillStyle = (x + y) % 64 ? '#222' : '#fff';
        c.fillRect(x, y, 32, 32);
      }
    c.fillStyle = '#f2b134';
    c.fillRect(120, 14, 272, 100);
    c.fillStyle = '#3a2a1a';
    c.font = 'bold 72px "Hiragino Maru Gothic ProN", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('ゴール', 256, 68);
  });
}

/** 次に通る門の目印。地面の光る帯と、その上で上下する矢印 */
function beacon() {
  const group = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({
    color: '#ffe066',
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    toneMapped: false
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22), glow);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.012;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: '#ffcf33', emissive: '#7a5400', roughness: 0.4 })
  );
  arrow.rotation.x = Math.PI;
  arrow.castShadow = true;
  group.add(strip, arrow);
  return {
    group,
    setWidth: (w: number) => strip.scale.set(w, 1, 1),
    update: (t: number) => {
      arrow.position.y = 0.95 + Math.abs(Math.sin(t * 3.2)) * 0.18;
      arrow.rotation.y = t * 2;
      glow.opacity = 0.45 + 0.3 * Math.sin(t * 5);
    }
  };
}
