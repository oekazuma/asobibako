import * as THREE from 'three';
import { finish, make, type Finish, type Pattern } from '../textures';
import type { Kind } from './layout';
import { box, copy, cyl, plane, type Maker } from './shapes';

const PILLAR: Finish = { tint: '#693016', rough: 0.5 };
const MULLION: Finish = { tint: '#141414', metal: 0.5, rough: 0.4 };

/** 壁から 12cm 出るだけなので当たらない */
function pilaster(g: THREE.Group) {
  box(g, [0.4, 3.3, 0.12], PILLAR, [0, 1.85, 0.06]);
  box(g, [0.5, 0.3, 0.16], PILLAR, [0, 0.15, 0.08]);
  box(g, [0.52, 0.22, 0.18], PILLAR, [0, 3.6, 0.09]);
}

/** 壁に貼るだけなので当たらない。桟は 2cm */
function archWindow(g: THREE.Group) {
  const [w, top] = [1.3, 2.4];
  const r = w / 2;
  const glass = new THREE.Shape();
  glass.moveTo(-r, 0.5);
  glass.lineTo(r, 0.5);
  glass.lineTo(r, top);
  glass.absarc(0, top, r, 0, Math.PI, false);
  glass.lineTo(-r, 0.5);
  const pane = new THREE.Mesh(new THREE.ShapeGeometry(glass, 16), finish({ tint: '#2b0f0f', rough: 0.9 }, [1, 1]));
  pane.position.z = 0.01;
  pane.receiveShadow = true;
  g.add(pane);
  for (const x of [-r / 2, 0, r / 2]) {
    const y = top + r * Math.sqrt(1 - (x / r) ** 2);
    box(g, [0.02, y - 0.5, 0.03], MULLION, [x, (y + 0.5) / 2, 0.025]);
  }
  for (const y of [0.95, 1.45, 1.95, top]) box(g, [w, 0.02, 0.03], MULLION, [0, y, 0.025]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 24, Math.PI), finish(PILLAR, [1, 1]));
  ring.position.set(0, top, 0.04);
  ring.castShadow = true;
  g.add(ring);
  const side = box(g, [0.1, top - 0.45, 0.08], PILLAR, [-r, (top + 0.45) / 2, 0.04]);
  copy(g, side, [r, (top + 0.45) / 2, 0.04]);
  box(g, [w + 0.2, 0.08, 0.14], PILLAR, [0, 0.46, 0.07]);
}

/** 赤い革のボタン留め。ボタンを結ぶひし形のしわ（2cm）と、ボタンのくぼみ */
export function tufted(): Pattern {
  return make('tufted', 128, 128, [0.24, 0.24], (g) => {
    g.fillStyle = '#7a1d20';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgb(40 6 8 / 0.5)';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(64, 0);
    g.lineTo(128, 64);
    g.lineTo(64, 128);
    g.closePath();
    g.stroke();
    g.fillStyle = 'rgb(30 4 6 / 0.7)';
    for (const [x, y] of [
      [0, 64],
      [64, 0],
      [128, 64],
      [64, 128]
    ]) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 机の下の暗い赤茶のじゅうたん（大広間の赤・紺・金のとは別）。縁取りの線は 2cm 以上 */
export function studyRug(): Pattern {
  return make('study-rug', 512, 768, [2.4, 3.6], (g) => {
    g.fillStyle = '#4a1c14';
    g.fillRect(0, 0, 512, 768);
    g.strokeStyle = '#2b100b';
    g.lineWidth = 34;
    g.strokeRect(17, 17, 478, 734);
    g.strokeStyle = '#8a5a34';
    g.lineWidth = 10;
    g.strokeRect(46, 46, 420, 676);
    g.fillStyle = '#5e2a1a';
    g.beginPath();
    g.moveTo(256, 140);
    g.lineTo(420, 384);
    g.lineTo(256, 628);
    g.lineTo(92, 384);
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a5a34';
    g.lineWidth = 10;
    g.stroke();
    g.fillStyle = '#2b100b';
    g.beginPath();
    g.ellipse(256, 384, 56, 90, 0, 0, Math.PI * 2);
    g.fill();
  });
}

/** 赤い革のひじ掛け椅子。前（+z）が座る側 */
function armchair(g: THREE.Group) {
  const red: Finish = { pattern: tufted(), rough: 0.45 };
  box(g, [0.9, 0.42, 0.85], red, [0, 0.21, 0.02]);
  box(g, [0.9, 0.62, 0.18], red, [0, 0.69, -0.34]);
  for (const x of [-0.39, 0.39]) box(g, [0.14, 0.26, 0.8], red, [x, 0.55, 0.03]);
  box(g, [0.64, 0.1, 0.62], red, [0, 0.47, 0.08]);
  for (const [x, z] of [
    [-0.38, 0.38],
    [0.38, 0.38],
    [-0.38, -0.38],
    [0.38, -0.38]
  ])
    cyl(g, [0.025, 0.02], 0.08, { tint: '#2a1a10', rough: 0.5 }, [x, 0.04, z], 10);
}

function stripes(): Pattern {
  return make('lamp-stripes', 64, 64, [0.12, 0.12], (g) => {
    g.fillStyle = '#f2a03a';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#c4580a';
    g.fillRect(0, 0, 24, 64);
  });
}

function floorLamp(g: THREE.Group) {
  const brass: Finish = { tint: '#b8933a', metal: 0.9, rough: 0.35 };
  cyl(g, [0.16, 0.18], 0.04, brass, [0, 0.02, 0]);
  cyl(g, [0.015, 0.015], 1.3, brass, [0, 0.67, 0], 10);
  const m = finish({ pattern: stripes(), rough: 0.6 }, [1.1, 0.3]);
  m.emissive.set('#da710a');
  m.emissiveIntensity = 0.6;
  m.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.3, 24, 1, true), m);
  shade.position.y = 1.42;
  g.add(shade);
}

export const STUDY_MAKERS = {
  pilaster,
  'arch-window': archWindow,
  armchair,
  'floor-lamp': floorLamp,
  'study-rug': (g) => plane(g, [2.4, 3.6], { pattern: studyRug(), rough: 0.95 }, [0, 0.005, 0], -Math.PI / 2)
} satisfies Partial<Record<Kind, Maker>>;
