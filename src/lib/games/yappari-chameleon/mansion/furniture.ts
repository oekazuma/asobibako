import * as THREE from 'three';
import type { Piece } from './layout';
import { ROOM_MAKERS } from './room-furniture';
import { ball, BLACK, box, cyl, glowing, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';

/** 本家の床の風船（黄緑・ピンク・黄・青緑・マゼンタ）。つやを写さないと丸まっても化けられない */
const BALLOONS = ['#9ccc2a', '#f48fb1', '#f6d32d', '#19b3a6', '#d81b8c'];

function piano(g: THREE.Group) {
  box(g, [1.5, 0.32, 2.0], BLACK, [0, 0.84, 0]);
  for (const [x, z] of [
    [-0.6, 0.8],
    [0.6, 0.8],
    [0, -0.8]
  ])
    cyl(g, [0.06, 0.05], 0.7, BLACK, [x, 0.35, z]);
  const lid = box(g, [1.45, 0.03, 1.9], BLACK, [0, 1.3, -0.25]);
  lid.rotation.x = -0.45;
  box(g, [1.3, 0.06, 0.18], WHITE, [0, 0.86, 1.08]);
  box(g, [1.3, 0.03, 0.08], BLACK, [0, 0.9, 1.04]);
}

function table(g: THREE.Group, cloth: string) {
  cyl(g, [0.6, 0.6], 0.04, { tint: cloth, rough: 0.9 }, [0, 0.74, 0], 32);
  cyl(g, [0.61, 0.68], 0.7, { tint: cloth, rough: 0.9 }, [0, 0.38, 0], 32);
}

function chair(g: THREE.Group) {
  box(g, [0.45, 0.05, 0.45], WOOD, [0, 0.45, 0]);
  for (const [x, z] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19]
  ])
    box(g, [0.04, 0.45, 0.04], WOOD, [x, 0.225, z]);
  box(g, [0.45, 0.5, 0.04], WOOD, [0, 0.72, -0.2]);
}

function column(g: THREE.Group) {
  box(g, [0.6, 0.15, 0.6], WHITE, [0, 0.075, 0]);
  cyl(g, [0.22, 0.25], 3.0, WHITE, [0, 1.65, 0], 32);
  box(g, [0.6, 0.15, 0.6], WHITE, [0, 3.225, 0]);
}

function sofa(g: THREE.Group) {
  const L: Finish = { pattern: leather(), rough: 0.45 };
  box(g, [2.0, 0.42, 0.9], L, [0, 0.21, 0]);
  box(g, [2.0, 0.55, 0.2], L, [0, 0.62, -0.35]);
  box(g, [0.2, 0.62, 0.9], L, [-0.9, 0.31, 0], [0.9, 0.62]);
  box(g, [0.2, 0.62, 0.9], L, [0.9, 0.31, 0], [0.9, 0.62]);
  box(g, [1.6, 0.12, 0.7], L, [0, 0.48, 0.05]);
}

function bench(g: THREE.Group) {
  box(g, [1.6, 0.06, 0.45], WOOD, [0, 0.43, 0]);
  for (const x of [-0.7, 0.7]) box(g, [0.06, 0.4, 0.4], WOOD, [x, 0.2, 0]);
}

function bookshelf(g: THREE.Group) {
  box(g, [0.05, 2.2, 0.4], WOOD, [-0.575, 1.1, 0]);
  box(g, [0.05, 2.2, 0.4], WOOD, [0.575, 1.1, 0]);
  box(g, [1.2, 0.05, 0.4], WOOD, [0, 2.175, 0]);
  box(g, [1.2, 2.2, 0.03], WOOD, [0, 1.1, -0.185]);
  plane(g, [1.1, 2.12], { pattern: books(), rough: 0.7 }, [0, 1.08, 0.17]);
}

function vase(g: THREE.Group) {
  const pts = [
    [0.18, 0],
    [0.24, 0.1],
    [0.3, 0.45],
    [0.22, 0.8],
    [0.14, 0.95],
    [0.2, 1.1]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const o = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), finish({ pattern: marble(), rough: 0.25 }, [1.6, 1.1]));
  o.castShadow = o.receiveShadow = true;
  g.add(o);
}

function balloons(g: THREE.Group, p: Piece) {
  const v = variant(p);
  const spots: [number, number, number][] = [
    [0, 1.55, 0],
    [0.22, 1.4, 0.1],
    [-0.2, 1.38, 0.12],
    [0.08, 1.3, -0.22],
    [-0.12, 1.62, -0.15]
  ];
  spots.forEach((at, i) => {
    ball(g, 0.2, { tint: BALLOONS[(v + i) % BALLOONS.length], rough: 0.18 }, at);
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, at[1], 4),
      finish({ tint: '#ffffff' }, [0.01, at[1]])
    );
    s.position.set(at[0] / 2, at[1] / 2, at[2] / 2);
    s.lookAt(at[0], at[1], at[2]);
    s.rotateX(Math.PI / 2);
    g.add(s);
  });
  box(g, [0.12, 0.08, 0.12], GOLD, [0, 0.04, 0]);
}

function balloon(g: THREE.Group, p: Piece) {
  ball(g, 0.22, { tint: BALLOONS[variant(p) % BALLOONS.length], rough: 0.18 }, [0, 0.22, 0]);
}

function horse(g: THREE.Group) {
  const S: Finish = { tint: '#f4f1ea', rough: 0.4 };
  box(g, [1.0, 0.5, 0.5], { tint: '#3b2414', rough: 0.5 }, [0, 0.25, 0]);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 8, 16), finish(S, [1, 1]));
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 1.1, 0);
  body.castShadow = true;
  g.add(body);
  for (const [x, z] of [
    [-0.3, -0.1],
    [-0.3, 0.1],
    [0.3, -0.1],
    [0.3, 0.1]
  ])
    cyl(g, [0.05, 0.04], 0.45, S, [x, 0.72, z]);
  const neck = cyl(g, [0.09, 0.12], 0.45, S, [0.45, 1.35, 0]);
  neck.rotation.z = -0.6;
  box(g, [0.32, 0.16, 0.16], S, [0.62, 1.58, 0]);
}

/** 本家のシャンデリアは金とクリスタルを何段も重ねた形。輪を 3 段にして、それぞれに灯りとしずくを下げる */
function chandelier(g: THREE.Group) {
  cyl(g, [0.02, 0.02], 1.4, GOLD, [0, 0.7, 0], 8);
  const crystal: Finish = { tint: '#e8f1ff', metal: 0.2, rough: 0.05 };
  const tiers: [number, number, number][] = [
    [0.7, 0, 10],
    [0.48, 0.32, 8],
    [0.26, 0.6, 6]
  ];
  for (const [r, y, n] of tiers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 48), finish(GOLD, [1, 1]));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), glowing('#fff3d0', '#ffe2a0', 2));
      bulb.position.set(Math.cos(a) * r, y + 0.07, Math.sin(a) * r);
      g.add(bulb);
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), finish(crystal, [0.1, 0.1]));
      drop.position.set(Math.cos(a + 0.3) * r, y - 0.12, Math.sin(a + 0.3) * r);
      drop.scale.y = 1.8;
      g.add(drop);
    }
  }
  ball(g, 0.12, GOLD, [0, -0.15, 0]);
}

function sconce(g: THREE.Group) {
  box(g, [0.06, 0.25, 0.04], GOLD, [0, 0, 0.02]);
  box(g, [0.04, 0.04, 0.25], GOLD, [0, 0.1, 0.14]);
  const glass = glowing('#f3e3c0', '#ffcf8a', 0.8);
  glass.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.18, 20, 1, true), glass);
  shade.position.set(0, 0.22, 0.27);
  g.add(shade);
}

function painting(g: THREE.Group) {
  box(g, [1.5, 1.2, 0.06], GOLD, [0, 0, 0.03]);
  // 絵柄は試合ごとに build.ts が材質ごと差し替える
  plane(g, [1.2, 0.9], { pattern: oilPainting(), rough: 0.6 }, [0, 0, 0.062]).userData.art = true;
}

function posterPiece(g: THREE.Group) {
  plane(g, [0.5, 0.75], { pattern: poster(), rough: 0.9 }, [0, 0, 0.01]);
}

/** 本家のリボンのすだれ。金属の箔の細い帯（幅 5cm）を 1.8m の幅にたくさん下げる */
function ribbons(g: THREE.Group, p: Piece) {
  const colors = ['#e53950', '#f6a623', '#f7e14a', '#4cc36f', '#3a8ee6', '#9b59d0', '#e0e0e0'];
  for (let i = 0; i < 34; i++) {
    const strip = plane(g, [0.05, 2.8], { tint: colors[(i + variant(p)) % colors.length], metal: 0.85, rough: 0.3 }, [
      -0.9 + i * 0.055,
      1.9,
      (i % 3) * 0.02
    ]);
    (strip.material as THREE.Material).side = THREE.DoubleSide;
  }
}

function bunting(g: THREE.Group, p: Piece) {
  const span = p.span ?? 10;
  const colors = ['#f8bbd0', '#b2ebf2', '#fff9c4', '#c5e1a5', '#d1c4e9'];
  const sag = (x: number) => -0.35 * (1 - ((2 * x) / span) ** 2);
  const shape = new THREE.Shape([new THREE.Vector2(-0.14, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0, -0.3)]);
  let i = 0;
  for (let x = -span / 2 + 0.2; x < span / 2; x += 0.4) {
    const m = finish({ tint: colors[i++ % colors.length], rough: 0.7 }, [0.3, 0.3]);
    m.side = THREE.DoubleSide;
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
    flag.position.set(x, sag(x), 0);
    g.add(flag);
  }
  const pts = Array.from({ length: 41 }, (_, k) => {
    const x = -span / 2 + (k / 40) * span;
    return new THREE.Vector3(x, sag(x), 0);
  });
  g.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' }))
  );
}

function banner(g: THREE.Group, p: Piece) {
  const tints = ['#c9a227', '#a3262f', '#2c5aa0', '#e0b83a'];
  const m = finish({ tint: tints[variant(p) % 4], rough: 0.8 }, [1.2, 2]);
  m.side = THREE.DoubleSide;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2), m);
  o.position.z = 0.02;
  g.add(o);
}

/** 大広間の大階段。坂の当たりに合わせて段を積み、赤い敷物と緑のガーランドを載せる */
function stairs(g: THREE.Group) {
  const n = 10;
  for (let k = 0; k < n; k++) {
    const h = (3.5 * (k + 1)) / n;
    box(g, [2.5, h, 0.55], WOOD, [0, h / 2, k * 0.55 + 0.275], [2.5, 0.55]);
    box(g, [1.4, 0.02, 0.55], { tint: '#8e1b1b', rough: 0.9 }, [0, h + 0.01, k * 0.55 + 0.275]);
  }
  for (const x of [-1.33, 1.33]) {
    for (let k = 0; k <= 22; k++) {
      const z = (k / 22) * 5.5;
      const y = (3.5 * z) / 5.5 + 0.95;
      ball(g, 0.07, { tint: '#2f6b35', rough: 0.8 }, [x, y, z]);
      if (k % 3 === 0) ball(g, 0.05, { tint: '#ffffff', rough: 0.6 }, [x, y + 0.06, z]);
    }
  }
}

function rugPiece(g: THREE.Group) {
  plane(g, [2.4, 3.6], { pattern: rug(), rough: 0.95 }, [0, 0.005, 0], -Math.PI / 2);
}

const MAKERS: Record<Piece['kind'], Maker> = {
  piano,
  rug: rugPiece,
  'table-white': (g) => table(g, '#f4f1ea'),
  'table-red': (g) => table(g, '#7a3324'),
  chair,
  column,
  sofa,
  bench,
  bookshelf,
  vase,
  balloons,
  balloon,
  horse,
  chandelier,
  sconce,
  painting,
  poster: posterPiece,
  ribbons,
  bunting,
  banner,
  stairs,
  ...ROOM_MAKERS
};

export function piece(p: Piece): THREE.Group {
  const g = new THREE.Group();
  MAKERS[p.kind](g, p);
  return g;
}
