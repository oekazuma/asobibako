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
function lump(g: THREE.Group, seed: number, size: [number, number, number], at: [number, number, number]) {
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
  const o = new THREE.Mesh(geo, finish({ pattern: marbled(), rough: 0.35 }, [0.3, 0.3]));
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
  const seed = Math.round(p.at[2] * 10);
  for (const [k, y] of [0.15, 0.7, 1.25].entries())
    for (let i = 0; i < 2 + ((seed + k) % 3); i++) {
      const s = 0.13 + ((seed + i * 7 + k) % 5) * 0.02;
      lump(
        g,
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
  // 持ち手は 120 度ずつの 2 枚の板で、あいだが窓に抜ける
  for (const start of [0, Math.PI]) {
    const arc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12, 1, true, start, (Math.PI * 2) / 3),
      finish(can, [0.25, 0.16])
    );
    arc.material.side = THREE.DoubleSide;
    arc.position.y = 0.95;
    arc.castShadow = true;
    g.add(arc);
  }
  cyl(g, [0.03, 0.035], 0.08, { tint: '#8a8f8a', metal: 0.7, rough: 0.35 }, [0, 0.9, 0], 12);
  box(g, [0.08, 0.025, 0.025], { tint: '#3a3d40', metal: 0.6, rough: 0.4 }, [0.03, 0.95, 0]);
}

export const KITCHEN_MAKERS = { drain, vent, 'meat-rack': meatRack, gas } satisfies Partial<Record<Kind, Maker>>;
