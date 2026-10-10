import * as THREE from 'three';
import { rng } from '../rng';
import { finish, make, type Finish, type Pattern } from '../textures';
import type { Kind, Piece } from './layout';
import { ball, box, copy, cyl, plane, type Maker } from './shapes';

/** 台の前の床の排水溝の格子。黒い鉄の棒と隙間はどちらも 2cm */
function grate(): Pattern {
  return make('grate', 64, 256, [0.08, 0.32], (g) => {
    g.fillStyle = '#050607';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#2a2f33';
    g.fillRect(0, 0, 32, 256);
    g.fillRect(0, 0, 64, 26);
  });
}

const IRON: Finish = { tint: '#3b3f43', metal: 0.6, rough: 0.5 };

/** ヘアラインのステンレス。横に流れる磨きの筋（2cm 以上）の明るさのむら */
function hairline(): Pattern {
  return make('hairline', 256, 64, [0.6, 0.15], (g) => {
    const r = rng(137);
    g.fillStyle = '#c9ced3';
    g.fillRect(0, 0, 256, 64);
    g.lineWidth = 9;
    for (let y = 4; y < 64; y += 9) {
      g.strokeStyle = `rgb(${r() < 0.5 ? '255 255 255' : '70 76 82'} / ${0.06 + r() * 0.1})`;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
  });
}

const steel = (): Finish => ({ pattern: hairline(), metal: 0.8, rough: 0.35 });
const DARK_STEEL: Finish = { tint: '#596066', metal: 0.8, rough: 0.3 };
const BLACK_IRON: Finish = { tint: '#151617', metal: 0.5, rough: 0.45 };

/** 上の面の無い箱（深い流しの槽）。両面を描くので、外からも中からも壁が見える */
function tub(g: THREE.Group, size: [number, number, number], at: [number, number, number]) {
  const geo = new THREE.BoxGeometry(...size);
  // 面の並びは +x, −x, +y, −y, +z, −z で、1 面に 6 個の頂点の番号
  const index = Array.from(geo.index!.array);
  geo.setIndex([...index.slice(0, 12), ...index.slice(18)]);
  geo.clearGroups();
  const m = finish(steel(), [size[0], size[1]]);
  m.side = THREE.DoubleSide;
  const o = new THREE.Mesh(geo, m);
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
}

/** 置いた向きの x へ span の長さに伸びる */
function drain(g: THREE.Group, p: { span?: number }) {
  const span = p.span ?? 4;
  plane(g, [span, 0.25], { pattern: grate(), metal: 0.6, rough: 0.45 }, [0, 0.004, 0], -Math.PI / 2);
}

/** 前（+z）が部屋の側 */
function vent(g: THREE.Group) {
  box(g, [0.42, 0.32, 0.06], IRON, [0, 0, 0.03]);
  box(g, [0.36, 0.26, 0.02], { tint: '#111315', rough: 0.8 }, [0, 0, 0.061]);
  const slat = box(g, [0.36, 0.025, 0.04], IRON, [0, -0.1, 0.07]);
  slat.rotation.x = 0.6;
  for (let k = 1; k < 5; k++) copy(g, slat, [0, -0.1 + k * 0.05, 0.07]).rotation.x = 0.6;
}

/** 生の肉の霜降り。赤桃色に白い脂の筋（2cm 以上）と、暗い赤のむら */
function marbled(): Pattern {
  return make('marbled', 256, 256, [0.3, 0.3], (g) => {
    const r = rng(131);
    g.fillStyle = '#c0625f';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgb(${120 + r() * 40} 30 35 / 0.25)`;
      g.beginPath();
      g.ellipse(r() * 256, r() * 256, 20 + r() * 30, 10 + r() * 16, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgb(246 232 222 / 0.7)';
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      g.lineWidth = 18 + r() * 10;
      g.beginPath();
      let [x, y] = [r() * 256, r() * 256];
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 90;
        y += (r() - 0.5) * 90;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

const BONE: Finish = { tint: '#efe6d8', rough: 0.6 };
const SHELF: Finish = { tint: '#0a0b0b', metal: 0.5, rough: 0.35 };

/** ふぞろいな肉の塊。球を向きの関数で凹凸させるので、継ぎ目の頂点も同じだけ動き、面が裂けない */
function lump(
  g: THREE.Group,
  mat: THREE.Material,
  seed: number,
  size: [number, number, number],
  at: [number, number, number]
) {
  const r = rng(seed);
  const [a, b, c] = [r() * 6, r() * 6, r() * 6];
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.16 * Math.sin(3 * v.x + a) * Math.sin(2 * v.y + b) + 0.1 * Math.sin(4 * v.z + c);
    pos.setXYZ(i, v.x * k * size[0], Math.max(v.y * k, -0.55) * size[1], v.z * k * size[2]);
  }
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, mat);
  o.position.set(...at);
  o.rotation.y = r() * Math.PI;
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  if (r() < 0.5)
    cyl(g, [0.035, 0.035], 0.02, BONE, [at[0] + size[0] * 0.6, at[1], at[2] + size[2] * 0.7], 12).rotation.x =
      Math.PI / 2;
}

/** 本家の棚板は網ではなく黒い金属の板 */
function meatRack(g: THREE.Group, p: Piece) {
  const post = box(g, [0.03, 2.0, 0.03], SHELF, [-0.785, 1.0, -0.235]);
  for (const [x, z] of [
    [0.785, -0.235],
    [-0.785, 0.235],
    [0.785, 0.235]
  ])
    copy(g, post, [x, 1.0, z]);
  const shelf = box(g, [1.6, 0.025, 0.5], SHELF, [0, 0.15, 0]);
  for (const y of [0.7, 1.25, 1.8]) copy(g, shelf, [0, y, 0]);
  // 肉は 1 つの棚で 1 つの材質を分け合う（塊ごとに作ると同じ模様を何度も GPU へ送る）
  const meat = finish({ pattern: marbled(), rough: 0.35 }, [0.3, 0.3]);
  const seed = Math.round(p.at[2] * 10);
  for (const [k, y] of [0.15, 0.7, 1.25].entries())
    for (let i = 0; i < 2 + ((seed + k) % 3); i++) {
      const s = 0.13 + ((seed + i * 7 + k) % 5) * 0.02;
      lump(
        g,
        meat,
        seed * 31 + k * 7 + i,
        [s * 1.3, s * 0.75, s],
        [-0.55 + i * 0.36, y + 0.0125 + s * 0.4, ((i % 2) - 0.5) * 0.12]
      );
    }
}

function gas(g: THREE.Group) {
  const can: Finish = { tint: '#b8bcb8', metal: 0.4, rough: 0.45 };
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24, 1, true), finish(can, [1, 0.06]));
  ring.material.side = THREE.DoubleSide;
  ring.position.y = 0.03;
  g.add(ring);
  cyl(g, [0.175, 0.175], 0.72, can, [0, 0.42, 0]);
  ball(g, 0.175, can, [0, 0.78, 0]).scale.y = 0.55;
  // 持ち手は 70 度の板 3 枚で、あいだの窓がどの向きからも見える
  for (const start of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const arc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.16, 16, 1, true, start, (Math.PI * 7) / 18),
      finish(can, [0.35, 0.16])
    );
    arc.material.side = THREE.DoubleSide;
    arc.position.y = 0.95;
    arc.castShadow = true;
    g.add(arc);
  }
  cyl(g, [0.03, 0.035], 0.08, { tint: '#8a8f8a', metal: 0.7, rough: 0.35 }, [0, 0.9, 0], 12);
  box(g, [0.08, 0.025, 0.025], { tint: '#3a3d40', metal: 0.6, rough: 0.4 }, [0.03, 0.95, 0]);
}

/** ステンレスの台。前（+z）に扉 2 枚 */
function counter(g: THREE.Group) {
  box(g, [2.0, 0.84, 0.7], steel(), [0, 0.42, 0]);
  box(g, [2.02, 0.04, 0.72], steel(), [0, 0.88, 0]);
  const door = box(g, [0.95, 0.7, 0.01], { tint: '#aeb4b9', metal: 0.8, rough: 0.3 }, [-0.5, 0.45, 0.355]);
  copy(g, door, [0.5, 0.45, 0.355]);
}

/** 前は +z で、蛇口は後ろの立ち上がりに付く */
function sink(g: THREE.Group) {
  const leg = box(g, [0.04, 0.6, 0.04], steel(), [-0.96, 0.3, -0.31]);
  for (const [x, z] of [
    [0.96, -0.31],
    [-0.96, 0.31],
    [0.96, 0.31]
  ])
    copy(g, leg, [x, 0.3, z]);
  box(g, [1.96, 0.025, 0.64], steel(), [0, 0.18, 0]);
  tub(g, [2.0, 0.32, 0.7], [0, 0.74, 0]);
  box(g, [1.96, 0.02, 0.66], DARK_STEEL, [0, 0.59, 0]);
  box(g, [2.0, 0.25, 0.03], steel(), [0, 1.025, -0.335]);
  cyl(g, [0.018, 0.018], 0.45, steel(), [0.3, 1.2, -0.29], 12);
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 16, Math.PI), finish(steel(), [0.4, 0.05]));
  spout.position.set(0.3, 1.42, -0.17);
  spout.rotation.y = Math.PI / 2;
  spout.castShadow = true;
  g.add(spout);
  const coil = new THREE.CatmullRomCurve3(
    Array.from({ length: 41 }, (_, k) => {
      const a = k * 0.6;
      return new THREE.Vector3(-0.5 + Math.cos(a) * 0.12, 0.22 + k * 0.006, Math.sin(a) * 0.12);
    })
  );
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(coil, 120, 0.022, 6),
    finish({ tint: '#3fbf3a', rough: 0.4 }, [1, 1])
  );
  hose.castShadow = true;
  g.add(hose);
}

/** 前（+z）がつまみとオーブンの扉 */
function range(g: THREE.Group) {
  box(g, [1.0, 0.86, 0.8], steel(), [0, 0.43, 0]);
  box(g, [1.0, 0.04, 0.8], BLACK_IRON, [0, 0.88, 0]);
  const burner = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), finish(BLACK_IRON, [0.6, 0.1]));
  burner.rotation.x = Math.PI / 2;
  for (const [x, z] of [
    [-0.25, -0.18],
    [0.25, -0.18],
    [-0.25, 0.18],
    [0.25, 0.18]
  ]) {
    const b = burner.clone();
    b.position.set(x, 0.91, z);
    g.add(b);
  }
  box(g, [0.86, 0.5, 0.02], DARK_STEEL, [0, 0.33, 0.405]);
  cyl(g, [0.015, 0.015], 0.7, steel(), [0, 0.62, 0.44], 12).rotation.z = Math.PI / 2;
  const knob = cyl(g, [0.03, 0.03], 0.04, { tint: '#1a1b1d', rough: 0.5 }, [-0.375, 0.76, 0.42], 16);
  knob.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.038, 0.008, 6, 20),
    finish({ tint: '#3a5bd8', rough: 0.4 }, [0.2, 0.02])
  );
  ring.position.set(-0.375, 0.76, 0.402);
  g.add(ring);
  for (let i = 1; i < 6; i++) {
    copy(g, knob, [-0.375 + i * 0.15, 0.76, 0.42]);
    const r = ring.clone();
    r.position.x = -0.375 + i * 0.15;
    g.add(r);
  }
}

function potRack(g: THREE.Group) {
  const post = box(g, [0.02, 1.8, 0.02], BLACK_IRON, [-0.29, 0.9, -0.19]);
  for (const [x, z] of [
    [0.29, -0.19],
    [-0.29, 0.19],
    [0.29, 0.19]
  ])
    copy(g, post, [x, 0.9, z]);
  const shelf = box(g, [0.6, 0.012, 0.4], BLACK_IRON, [0, 0.35, 0]);
  for (const y of [0.8, 1.25, 1.7]) copy(g, shelf, [0, y, 0]);
  const pot = cyl(g, [0.14, 0.13], 0.2, DARK_STEEL, [-0.1, 0.46, 0]);
  copy(g, pot, [0.12, 1.36, 0]).scale.set(0.8, 0.9, 0.8);
  cyl(g, [0.12, 0.11], 0.05, BLACK_IRON, [0.05, 0.835, 0]);
  box(g, [0.18, 0.02, 0.03], BLACK_IRON, [-0.17, 0.85, 0]);
}

function pots(g: THREE.Group) {
  cyl(g, [0.16, 0.15], 0.3, DARK_STEEL, [-0.6, 0.15, 0]);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    finish({ tint: '#f1ece2', rough: 0.4 }, [0.4, 0.2])
  );
  bowl.material.side = THREE.DoubleSide;
  bowl.position.set(-0.15, 0.13, 0.05);
  bowl.castShadow = true;
  g.add(bowl);
  const blue = bowl.clone();
  blue.material = finish({ tint: '#3f7ec7', rough: 0.4 }, [0.4, 0.2]);
  blue.material.side = THREE.DoubleSide;
  blue.position.set(0.2, 0.13, -0.08);
  g.add(blue);
  for (const [x, z, s] of [
    [0.55, 0.05, 0.09],
    [0.68, -0.08, 0.08],
    [0.6, -0.14, 0.07]
  ])
    ball(g, s, { tint: '#5d9a43', rough: 0.6 }, [x, s, z]);
}

function board(g: THREE.Group) {
  box(g, [1.0, 0.04, 0.6], { tint: '#c9a777', rough: 0.7 }, [0, 0.02, 0]);
}

export const KITCHEN_MAKERS = {
  drain,
  vent,
  'meat-rack': meatRack,
  gas,
  counter,
  sink,
  range,
  'pot-rack': potRack,
  pots,
  board
} satisfies Partial<Record<Kind, Maker>>;
