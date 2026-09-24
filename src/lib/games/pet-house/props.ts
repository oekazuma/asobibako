import * as THREE from 'three';
import { furMaterial } from './fur';
import { once, paint, seeded } from './textures';
import type { ToyId } from './types';
import { createWand, POM, type Wand } from './wand';

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
 * ねこじゃらし。group はシーンの原点に置き、draw に wand.ts の揺れと竿の手元（grip）を渡す。
 * 手元は画面の上の外に置き、細い竿を上から入れる（手前へのばすとカメラの前を太く横切る）。
 * 竿の先から細いひもを垂らし、先に羽根を数枚とふわふわの房を付ける
 */
export function wandModel() {
  const group = new THREE.Group();
  const unit = cyl(1, 1, 1, 6);
  const rodMat = mat('#2b2724', { roughness: 0.3, metalness: 0.15 });
  const rod = Array.from({ length: ROD_SEGMENTS }, () => mesh(unit, rodMat));
  const cord = Array.from({ length: POM }, () => mesh(unit, mat('#d8cfc2', { roughness: 0.9 })));
  const tuft = new THREE.Group();
  tuft.add(pom(), mesh(sphere(0.005, 10, 8), mat('#b9b4ad', { roughness: 0.3, metalness: 0.9 }), 0, 0.02, 0));
  const kinds: Plume[] = ['pheasant', 'rose', 'guinea', 'pheasant', 'rose', 'guinea'];
  const feathers = kinds.map((kind, i) => {
    const holder = new THREE.Group();
    holder.rotation.y = (i / kinds.length) * Math.PI * 2;
    const f = new THREE.Mesh(featherGeometry(i % 2 ? 0.14 : 0.12), plume(kind));
    holder.add(f);
    tuft.add(holder);
    return f;
  });
  group.add(...rod, ...cord, tuft);

  const grip = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const dir = new THREE.Vector3();
  let spin = 0;
  let last = 0;
  function draw(w: Wand, t: number, at?: THREE.Vector3) {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const hand = w.hand;
    if (at) grip.copy(at);
    else grip.set(hand.x + 0.3, hand.y + 1.3, hand.z + 0.35);
    // まっすぐな竿の 6 割の所を曲げの支点にし、しなって遅れた先（tip）まで 2 次曲線でつなぐ
    bend
      .set(hand.x, hand.y - 0.05, hand.z)
      .sub(grip)
      .multiplyScalar(0.55)
      .add(grip);
    tip.set(w.tip.x, w.tip.y, w.tip.z);
    for (let i = 0; i < ROD_SEGMENTS; i++) {
      quad(a, i / ROD_SEGMENTS, grip, bend, tip);
      quad(b, (i + 1) / ROD_SEGMENTS, grip, bend, tip);
      span(rod[i], a, b, 0.0055 - (0.0032 * i) / ROD_SEGMENTS);
    }
    for (let i = 0; i < POM; i++) {
      const p = w.nodes[i];
      const q = w.nodes[i + 1];
      span(cord[i], a.set(p.x, p.y, p.z), b.set(q.x, q.y, q.z), 0.0011);
    }
    const p = w.nodes[POM];
    const q = w.nodes[POM + 1];
    tuft.position.set(p.x, p.y, p.z);
    dir.set(q.x - p.x, q.y - p.y, q.z - p.z).normalize();
    tuft.quaternion.setFromUnitVectors(down, dir);
    // 羽根の房は振るとくるくる回り、1 枚ずつ風にあおられてふるえる
    const gust = Math.min(1, w.speed / 1.5);
    spin += dt * w.speed * 5;
    tuft.rotateY(spin);
    feathers.forEach((f, i) => {
      const ph = i * 1.7;
      f.rotation.x = -0.14 - gust * 0.25 - Math.sin(t * (9 + i * 1.3) + ph) * (0.03 + 0.3 * gust);
      f.rotation.z = Math.sin(t * (6 + i) + ph * 2) * (0.02 + 0.2 * gust);
    });
  }
  draw(createWand({ x: 0, y: 0.1, z: 0 }), 0);
  return { group, draw };
}

const ROD_SEGMENTS = 14;
const up = new THREE.Vector3(0, 1, 0);

function quad(out: THREE.Vector3, s: number, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
  const u = 1 - s;
  return out.set(
    u * u * p0.x + 2 * u * s * p1.x + s * s * p2.x,
    u * u * p0.y + 2 * u * s * p1.y + s * s * p2.y,
    u * u * p0.z + 2 * u * s * p1.z + s * s * p2.z
  );
}

/** 半径 1・高さ 1 の円柱を a から b へ渡す */
function span(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  m.position.addVectors(a, b).multiplyScalar(0.5);
  const d = b.clone().sub(a);
  const len = d.length();
  m.scale.set(r, Math.max(len, 1e-4), r);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(up, d.divideScalar(len));
}

/** 羽根 1 枚。付け根が原点で -y へのび、先ほど外へ反る */
function featherGeometry(len: number) {
  return geo(`feather:${len}`, () => {
    const g = new THREE.PlaneGeometry(len * 0.32, len, 1, 8).translate(0, -len / 2, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, 1.6 * y * y);
    }
    g.computeVertexNormals();
    return g;
  });
}

type Plume = 'pheasant' | 'rose' | 'guinea';

/** 羽根の絵。上が付け根（羽柄の綿毛）、下が羽先。羽枝を 1 本ずつ引き、ところどころ裂け目を入れる */
function plume(kind: Plume) {
  const map = once(`plume:${kind}`, () =>
    paint(64, 256, (g) => {
      const rnd = seeded(kind.length * 31 + 5);
      const cx = 32;
      for (let y = 2; y < 250; y += 1.1) {
        const u = y / 256;
        const half = 29 * Math.pow(Math.sin(Math.PI * (0.06 + 0.9 * u)), 0.55);
        const down = u < 0.24;
        for (const side of [-1, 1]) {
          if (!down && rnd() < 0.05) continue;
          const len = half * (0.85 + 0.2 * rnd());
          const bar = Math.sin(y * (kind === 'pheasant' ? 0.16 : 0.1)) > 0.55;
          g.strokeStyle = barb(kind, u, bar, rnd);
          g.globalAlpha = down ? 0.35 : 0.8;
          g.lineWidth = down ? 0.8 : 1.1;
          g.beginPath();
          g.moveTo(cx, y);
          const sag = down ? 10 * (rnd() - 0.5) : 0;
          g.quadraticCurveTo(cx + side * len * 0.5, y + len * 0.15 + sag, cx + side * len, y + len * 0.5 + sag);
          g.stroke();
          if (kind === 'guinea' && !down && rnd() < 0.12) {
            g.fillStyle = '#f4f1ea';
            g.globalAlpha = 0.9;
            g.beginPath();
            g.arc(cx + side * len * (0.3 + 0.5 * rnd()), y + len * 0.3, 1.6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      g.globalAlpha = 1;
      g.strokeStyle = kind === 'rose' ? '#f6d9e2' : '#efe3cf';
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(cx, 252);
      g.stroke();
    })
  );
  return new THREE.MeshStandardMaterial({
    map,
    side: THREE.DoubleSide,
    alphaTest: 0.25,
    alphaToCoverage: true,
    roughness: 0.8
  });
}

function barb(kind: Plume, u: number, bar: boolean, rnd: () => number) {
  const j = Math.round((rnd() - 0.5) * 12);
  if (kind === 'pheasant') return bar ? `hsl(20 45% ${14 + j / 3}%)` : `hsl(${30 + j} 60% ${42 + u * 12}%)`;
  if (kind === 'guinea') return `hsl(220 10% ${22 + j / 2}%)`;
  return `hsl(${340 + j} ${70 - u * 20}% ${u < 0.24 ? 88 : 68 - u * 14}%)`;
}

/** 羽根の付け根を包むマラボーの房。ペットと同じ毛の殻を重ねて、ふわふわに見せる */
function pom() {
  const g = new THREE.Group();
  const s = new THREE.SphereGeometry(0.016, 16, 12);
  const n = s.attributes.position.count;
  const color = new THREE.Color('#f8d3de');
  s.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Float32Array(n * 3).map((_, i) => color.toArray()[i % 3]),
      3
    )
  );
  s.setAttribute('furLen', new THREE.BufferAttribute(new Float32Array(n).fill(0.02), 1));
  s.setAttribute(
    'furComb',
    new THREE.BufferAttribute(
      new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? -0.7 : 0)),
      3
    )
  );
  const layers = 10;
  for (let i = 0; i <= layers; i++) {
    const m = new THREE.Mesh(s, furMaterial(i, layers, 0.0014));
    m.castShadow = i === 0;
    g.add(m);
  }
  return g;
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
