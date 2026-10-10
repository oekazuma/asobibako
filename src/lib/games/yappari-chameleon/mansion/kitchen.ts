import * as THREE from 'three';
import { make, type Finish, type Pattern } from '../textures';
import type { Kind } from './layout';
import { box, copy, plane, type Maker } from './shapes';

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

export const KITCHEN_MAKERS = { drain, vent } satisfies Partial<Record<Kind, Maker>>;
