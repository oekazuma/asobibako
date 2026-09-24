import * as THREE from 'three';
import type { ToyId } from './types';

/**
 * 部屋と公園に置く小物。単位はメートル。
 * 部屋の家具と同じく、球・円柱・回転体などの組み合わせで作り、材質（金属・フェルト・紙・木）で見分けさせる
 */

const materials = new Map<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>();

/** physical を渡すと布の sheen などを使える MeshPhysicalMaterial にする（重いので小物だけ） */
export function mat(
  color: string,
  extra: THREE.MeshStandardMaterialParameters = {},
  physical?: THREE.MeshPhysicalMaterialParameters
) {
  const key = color + JSON.stringify(extra) + JSON.stringify(physical ?? null);
  let m = materials.get(key);
  if (!m) {
    m = physical
      ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, ...extra, ...physical })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    m.userData.shared = true;
    materials.set(key, m);
  }
  return m;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。部屋の脚やクッションで何十個も同じ形が出る */
export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geometries.set(key, g);
  }
  return g;
}

export const sphere = (r: number, w = 20, h = 14) =>
  geo(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`cyl:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
export const box = (w: number, h: number, d: number) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const torus = (r: number, tube: number, rad = 8, tubular = 24) =>
  geo(`torus:${r}:${tube}:${rad}:${tubular}`, () => new THREE.TorusGeometry(r, tube, rad, tubular));
export const capsule = (r: number, l: number) => geo(`capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | string,
  x = 0,
  y = 0,
  z = 0,
  shadow = true
) {
  const m = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** 皿の内側の半径を高さ y の関数で。中身の円盤をふちに合わせて広げるのに使う */
const BOWL = { bottom: 0.075, top: 0.11, floor: 0.012, depth: 0.058 };
const bowlInner = (y: number) =>
  BOWL.bottom - 0.008 + ((BOWL.top - BOWL.bottom) * (y - BOWL.floor)) / (BOWL.depth - BOWL.floor);

/** ステンレスのお皿。原点は床に接する中心。直径は 0.24m ほど。つやは scene.environment の映り込みで出る */
export function bowl() {
  const group = new THREE.Group();
  const outline = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(BOWL.bottom + 0.01, 0),
    new THREE.Vector2(BOWL.top + 0.012, BOWL.depth),
    new THREE.Vector2(BOWL.top + 0.004, BOWL.depth + 0.006),
    new THREE.Vector2(BOWL.top - 0.004, BOWL.depth),
    new THREE.Vector2(bowlInner(BOWL.floor), BOWL.floor),
    new THREE.Vector2(0, BOWL.floor)
  ];
  const shell = geo('bowl', () => new THREE.LatheGeometry(outline, 32));
  group.add(mesh(shell, mat('#d9dde2', { metalness: 0.95, roughness: 0.22, side: THREE.DoubleSide })));

  const disc = cyl(1, 1, 0.004, 28);
  const food = mesh(disc, '#7a4522', 0, 0, 0, false);
  // 粒のでこぼこ。円盤と一緒に上下させ、量に合わせて広がりも変える
  const kibble = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = i * 2.4;
    const r = 0.15 + ((i * 0.37) % 1) * 0.68;
    const k = mesh(sphere(0.13, 8, 6), i % 3 ? '#9a5a2c' : '#6f3c1c', Math.cos(a) * r, 0.03, Math.sin(a) * r, false);
    k.scale.y = 0.6;
    kibble.add(k);
  }
  food.add(kibble);
  const water = mesh(
    disc,
    new THREE.MeshPhysicalMaterial({
      color: '#bfdde8',
      transparent: true,
      opacity: 0.55,
      roughness: 0.05,
      clearcoat: 1
    }),
    0,
    0,
    0,
    false
  );
  group.add(food, water);
  food.visible = water.visible = false;

  function setFill(kind: 'food' | 'water' | null, amount: number) {
    const a = Math.min(1, Math.max(0, amount));
    food.visible = kind === 'food' && a > 0;
    water.visible = kind === 'water' && a > 0;
    const inner = food.visible ? food : water;
    const y = BOWL.floor + 0.004 + a * (BOWL.depth - BOWL.floor - 0.012);
    const r = bowlInner(y) - 0.002;
    inner.position.y = y;
    inner.scale.set(r, 1, r);
    // 円盤は横にだけ r 倍しているので、粒が平たくならないよう縦も r 倍にそろえる
    kibble.scale.set(1, r, 1);
  }
  return { group, setFill };
}

/** おもちゃ。原点は形の中心。半径はボール 0.045・フリスビー 0.11（厚み 0.03）・ねずみ 0.03 ほど */
export function toyModel(kind: ToyId): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'ball') {
    // テニスボールのフェルト。sheen で輪郭がふわっと明るくなる
    g.add(
      mesh(
        sphere(0.045, 28, 20),
        mat('#cde03a', { roughness: 1 }, { sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#f4ffb0') })
      )
    );
    for (const s of [1, -1]) {
      const seam = mesh(torus(0.0448, 0.0028, 6, 40), mat('#f3f1e6', { roughness: 0.9 }), 0, 0, 0, false);
      seam.rotation.set(Math.PI / 2 + s * 0.5, s * 0.5, 0);
      g.add(seam);
    }
  } else if (kind === 'frisbee') {
    const outline = [
      new THREE.Vector2(0, 0.008),
      new THREE.Vector2(0.09, 0.006),
      new THREE.Vector2(0.11, -0.002),
      new THREE.Vector2(0.108, -0.014),
      new THREE.Vector2(0.1, -0.012),
      new THREE.Vector2(0.098, 0)
    ];
    g.add(
      mesh(
        geo('frisbee', () => new THREE.LatheGeometry(outline, 32)),
        mat('#e2574c', { side: THREE.DoubleSide, roughness: 0.35 })
      )
    );
    g.add(
      mesh(torus(0.06, 0.003, 6, 32), mat('#f0f0ea', { roughness: 0.35 }), 0, 0.008, 0, false).rotateX(Math.PI / 2)
    );
  } else if (kind === 'mouse') {
    const body = mesh(
      sphere(0.03),
      mat('#8d8a86', { roughness: 1 }, { sheen: 1, sheenColor: new THREE.Color('#d8d4cc') })
    );
    body.scale.set(0.9, 0.8, 1.4);
    g.add(body);
    for (const dx of [-0.017, 0.017]) {
      const ear = mesh(cyl(0.013, 0.013, 0.004, 14), '#ffb3c1', dx, 0.024, 0.02);
      ear.rotation.x = Math.PI / 2;
      g.add(ear);
      g.add(mesh(sphere(0.004, 8, 6), '#2b2d42', dx * 0.55, 0.008, 0.038, false));
    }
    g.add(mesh(sphere(0.006, 8, 6), '#ff8fa3', 0, 0, 0.043, false));
    const tail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.005, -0.04),
      new THREE.Vector3(0.015, -0.015, -0.065),
      new THREE.Vector3(-0.01, -0.02, -0.09),
      new THREE.Vector3(0.012, -0.022, -0.11)
    ]);
    g.add(
      mesh(
        geo('mouse-tail', () => new THREE.TubeGeometry(tail, 16, 0.003, 6)),
        '#ff8fa3',
        0,
        0,
        0,
        false
      )
    );
  } else {
    return wandModel().group;
  }
  return g;
}

/**
 * ねこじゃらし。group はシーンの原点に置き、setTip にふさの位置（シーンの座標）を渡す。
 * 棒はふさから手前上へのび、画面の外で持っているように見せる
 */
export function wandModel() {
  const group = new THREE.Group();
  const stick = mesh(cyl(0.006, 0.009, 1, 8), mat('#b9864f', { roughness: 0.55 }), 0, 0, 0, false);
  const tuft = new THREE.Group();
  const colors = ['#e59ab6', '#e8c35a', '#f2ede2'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const f = mesh(
      capsule(0.014, 0.06),
      mat(colors[i % 3], { roughness: 1 }, { sheen: 1, sheenColor: new THREE.Color('#ffffff') }),
      Math.cos(a) * 0.03,
      -0.035,
      Math.sin(a) * 0.03
    );
    f.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    tuft.add(f);
  }
  tuft.add(mesh(sphere(0.02, 10, 8), mat('#d9789c', { roughness: 1 }), 0, 0, 0, false));
  group.add(stick, tuft);

  const handle = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  function setTip(x: number, y: number, z: number) {
    tip.set(x, y, z);
    tuft.position.set(x, y + 0.02, z);
    handle.set(x * 0.6, y + 0.9, z + 0.8);
    const dir = handle.clone().sub(tip);
    const len = dir.length();
    stick.scale.set(1, len, 1);
    stick.position.copy(tip).addScaledVector(dir, 0.5);
    stick.quaternion.setFromUnitVectors(up, dir.normalize());
  }
  setTip(0, 0.1, 0);
  return { group, setTip };
}

/** プレゼント箱。原点は底の中心、0.2m 角 */
export function present(): THREE.Group {
  const g = new THREE.Group();
  const s = 0.2;
  const paper = mat('#d9566f', { roughness: 0.45 });
  g.add(mesh(box(s, s * 0.8, s), paper, 0, s * 0.4, 0));
  g.add(mesh(box(s * 1.06, s * 0.2, s * 1.06), paper, 0, s * 0.85, 0));
  // サテンのリボン。つやを強めにして紙の箱と差を付ける
  const ribbon = mat('#e9c25a', { roughness: 0.25, metalness: 0.3 });
  g.add(mesh(box(s * 0.2, s * 0.96, s * 1.08), ribbon, 0, s * 0.48, 0, false));
  g.add(mesh(box(s * 1.08, s * 0.96, s * 0.2), ribbon, 0, s * 0.48, 0, false));
  for (const side of [-1, 1]) {
    const loop = mesh(torus(0.035, 0.012, 8, 16), ribbon, side * 0.035, s * 0.98, 0);
    loop.rotation.z = side * 0.6;
    loop.scale.set(1, 1, 0.5);
    g.add(loop);
  }
  g.add(mesh(sphere(0.018, 10, 8), ribbon, 0, s * 0.97, 0));
  return g;
}

/** ブラシ。原点は毛先の中心で、毛は -y へ、柄は手前（+z）の上へのびる */
export function brushModel(): THREE.Group {
  const g = new THREE.Group();
  const beech = mat('#c79a64', { roughness: 0.45 });
  const head = mesh(box(0.09, 0.025, 0.13), beech, 0, 0.035, 0);
  g.add(head);
  const bristles = mat('#3a3027', { roughness: 0.8 });
  for (let ix = -1; ix <= 1; ix++)
    for (let iz = -2; iz <= 2; iz++)
      g.add(mesh(cyl(0.008, 0.006, 0.022, 6), bristles, ix * 0.028, 0.011, iz * 0.024, false));
  const handle = mesh(capsule(0.014, 0.14), beech, 0, 0.075, 0.13);
  handle.rotation.x = Math.PI / 2 - 0.5;
  g.add(handle);
  return g;
}
