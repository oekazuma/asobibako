import * as THREE from 'three';
import { rng } from '../rng';
import { finish, make, type Finish, type Pattern } from '../textures';
import type { Kind, Piece } from './layout';
import { ball, box, copy, cyl, glowing, plane, variant, type Maker } from './shapes';

/** 置いた場所は天井の面で、梁はその下に付く */
function beam(g: THREE.Group) {
  box(g, [10, 0.22, 0.2], { tint: '#2a1a12', rough: 0.7 }, [0, -0.11, 0]);
}

/** 置いた場所は天井の面で、下へ付く */
function tubeLight(g: THREE.Group) {
  box(g, [1.24, 0.05, 0.15], { tint: '#c9ccd0', metal: 0.6, rough: 0.4 }, [0, -0.045, 0]);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.16, 12), glowing('#f6f5f6', '#ffffff', 1.6));
  tube.position.y = -0.09;
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
}

/** 格子柄のシャツの布。赤と灰の太い帯（4cm）に細い帯（2cm）を重ねる */
function plaid(): Pattern {
  return make('plaid', 128, 128, [0.24, 0.24], (g) => {
    g.fillStyle = '#d9d4cc';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgb(176 52 48 / 0.75)';
    g.fillRect(0, 16, 128, 22);
    g.fillRect(16, 0, 22, 128);
    g.fillStyle = 'rgb(70 70 78 / 0.55)';
    g.fillRect(0, 80, 128, 11);
    g.fillRect(80, 0, 11, 128);
  });
}

function rainbowStripes(): Pattern {
  return make('rainbow-stripes', 32, 256, [0.06, 0.48], (g) => {
    ['#e53950', '#f6a623', '#f7e14a', '#4cc36f', '#3a8ee6', '#9b59d0'].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, (i * 256) / 6, 32, 256 / 6 + 1);
    });
  });
}

type Cut = 'tee' | 'long' | 'pants';

/** 吊るした服の形。上の辺（y = 0）が洗濯ひもで、下へ垂れる（m） */
function cut(kind: Cut): THREE.Shape {
  const pts: [number, number][] =
    kind === 'pants'
      ? [
          [-0.2, 0],
          [0.2, 0],
          [0.23, -0.75],
          [0.04, -0.75],
          [0, -0.26],
          [-0.04, -0.75],
          [-0.23, -0.75]
        ]
      : kind === 'tee'
        ? [
            [-0.08, 0],
            [-0.24, -0.02],
            [-0.39, -0.13],
            [-0.32, -0.25],
            [-0.21, -0.19],
            [-0.22, -0.6],
            [0.22, -0.6],
            [0.21, -0.19],
            [0.32, -0.25],
            [0.39, -0.13],
            [0.24, -0.02],
            [0.08, 0]
          ]
        : [
            [-0.08, 0],
            [-0.25, -0.02],
            [-0.38, -0.46],
            [-0.28, -0.5],
            [-0.21, -0.22],
            [-0.23, -0.66],
            [0.23, -0.66],
            [0.21, -0.22],
            [0.28, -0.5],
            [0.38, -0.46],
            [0.25, -0.02],
            [0.08, 0]
          ];
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

/** 本家の洗濯ひもの服（T シャツ・格子柄のシャツ・黒い上着・虹色のしま・ズボン） */
const CLOTHES: [Cut, () => Finish][] = [
  ['tee', () => ({ tint: '#8a5ab8', rough: 0.9 })],
  ['long', () => ({ pattern: plaid(), rough: 0.9 })],
  ['tee', () => ({ tint: '#e07a9a', rough: 0.9 })],
  ['long', () => ({ tint: '#1e1e22', rough: 0.85 })],
  ['tee', () => ({ tint: '#eeeeea', rough: 0.9 })],
  ['pants', () => ({ tint: '#3a4f7a', rough: 0.9 })],
  ['tee', () => ({ pattern: rainbowStripes(), rough: 0.9 })],
  ['tee', () => ({ tint: '#3f9a4a', rough: 0.9 })],
  ['long', () => ({ tint: '#a8c43a', rough: 0.9 })]
];

/**
 * より合わせた縄に木の洗濯ばさみで留めた服。x の向きに span の長さで張る。当たらない。
 * 縄は真ん中で 8cm たるみ、服はたるみに合わせて吊るす
 */
function clothesline(g: THREE.Group, p: Piece) {
  const span = p.span ?? 8;
  const sag = (x: number) => -0.08 * (1 - ((2 * x) / span) ** 2);
  const rope = new THREE.CatmullRomCurve3(
    Array.from({ length: 9 }, (_, k) => {
      const x = -span / 2 + (k / 8) * span;
      return new THREE.Vector3(x, sag(x), 0);
    })
  );
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(rope, 48, 0.012, 6),
    finish({ tint: '#b89a6a', rough: 0.9 }, [1, 1])
  );
  g.add(line);
  const r = rng(variant(p));
  const peg: Finish = { tint: '#c9a54a', rough: 0.7 };
  const n = Math.floor(span / 1.1);
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span / n) * (i + 0.5) + (r() - 0.5) * 0.2;
    const [kind, look] = CLOTHES[(i + variant(p)) % CLOTHES.length];
    const m = finish(look(), [1, 1]);
    m.side = THREE.DoubleSide;
    const cloth = new THREE.Mesh(new THREE.ShapeGeometry(cut(kind)), m);
    cloth.position.set(x, sag(x) - 0.01, 0);
    cloth.rotation.y = (r() - 0.5) * 0.3;
    cloth.castShadow = cloth.receiveShadow = true;
    g.add(cloth);
    for (const dx of [-0.16, 0.16]) box(g, [0.02, 0.07, 0.03], peg, [x + dx, sag(x + dx) - 0.02, 0]);
  }
}

/** 本家のタオルの色（白か灰・青・黄色から橙） */
const TOWELS = ['#d8d8d0', '#3a46c8', '#e0a020', '#efefe8', '#4a56d8'];

/** たたんだタオルを 1 枚ずつ少し回してずらしながら積む。積んだ高さを返す */
function stack(g: THREE.Group, seed: number, n: number, at: [number, number, number]): number {
  const r = rng(seed);
  const tint = TOWELS[seed % TOWELS.length];
  let y = at[1];
  for (let i = 0; i < n; i++) {
    const h = 0.04 + r() * 0.01;
    const t = box(g, [0.48, h, 0.34], { tint: r() < 0.8 ? tint : TOWELS[(seed + 1) % 5], rough: 0.95 }, [
      at[0] + (r() - 0.5) * 0.04,
      y + h / 2,
      at[2] + (r() - 0.5) * 0.04
    ]);
    t.rotation.y = (r() - 0.5) * 0.16;
    y += h;
  }
  return y;
}

/** 動く物のタオルの山（当たりは 0.5 × 0.5 × 0.4 のまま） */
function towels(g: THREE.Group, p: Piece) {
  stack(g, variant(p), 10, [0, 0, 0]);
}

const TABLE: Finish = { tint: '#59402a', rough: 0.6 };

/** 木の台に高く積んだタオルの山 4 つ。当たりは山の上まで */
function towelTable(g: THREE.Group, p: Piece) {
  box(g, [1.6, 0.05, 0.75], TABLE, [0, 0.775, 0]);
  const leg = box(g, [0.06, 0.75, 0.06], TABLE, [-0.75, 0.375, -0.32]);
  for (const [x, z] of [
    [0.75, -0.32],
    [-0.75, 0.32],
    [0.75, 0.32]
  ])
    copy(g, leg, [x, 0.375, z]);
  box(g, [1.5, 0.03, 0.65], TABLE, [0, 0.2, 0]);
  [-0.55, -0.15, 0.25, 0.6].forEach((x, i) =>
    stack(g, variant(p) + i * 3, 6 + ((variant(p) + i) % 5), [x, 0.8, i % 2 ? 0.12 : -0.12])
  );
}

function woodShelf(g: THREE.Group) {
  const wood: Finish = { tint: '#b98a5a', rough: 0.6 };
  const post = box(g, [0.04, 1.1, 0.04], wood, [-0.23, 0.55, -0.18]);
  for (const [x, z] of [
    [0.23, -0.18],
    [-0.23, 0.18],
    [0.23, 0.18]
  ])
    copy(g, post, [x, 0.55, z]);
  const shelf = box(g, [0.5, 0.03, 0.4], wood, [0, 0.1, 0]);
  for (const y of [0.55, 1.08]) copy(g, shelf, [0, y, 0]);
  box(g, [0.18, 0.26, 0.12], { tint: '#f2f2ee', rough: 0.5 }, [0.05, 1.225, 0]);
  cyl(g, [0.025, 0.025], 0.04, { tint: '#3a6ee6', rough: 0.4 }, [0.1, 1.375, 0], 12);
}

function extinguisher(g: THREE.Group) {
  cyl(g, [0.075, 0.075], 0.44, { tint: '#c8231e', rough: 0.35 }, [0, 0.22, 0], 20);
  ball(g, 0.075, { tint: '#c8231e', rough: 0.35 }, [0, 0.44, 0]).scale.y = 0.5;
  cyl(g, [0.02, 0.02], 0.07, { tint: '#222222', rough: 0.5 }, [0, 0.5, 0], 10);
  box(g, [0.09, 0.012, 0.025], { tint: '#222222', rough: 0.5 }, [0.03, 0.54, 0]);
  const hose = box(g, [0.018, 0.3, 0.018], { tint: '#1a1a1a', rough: 0.6 }, [0.06, 0.36, 0.04]);
  hose.rotation.z = -0.15;
  plane(g, [0.08, 0.12], { tint: '#f2f2ee', rough: 0.6 }, [0, 0.24, 0.076]);
}

function vacuum(g: THREE.Group, p: Piece) {
  cyl(g, [0.17, 0.16], 0.26, { tint: '#c9ced3', metal: 0.7, rough: 0.35 }, [0, 0.15, 0]);
  ball(g, 0.17, { tint: '#c8231e', rough: 0.35 }, [0, 0.28, 0]).scale.y = 0.45;
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI),
    finish({ tint: '#222222' }, [1, 1])
  );
  handle.position.y = 0.35;
  g.add(handle);
  for (const [x, z] of [
    [0.12, 0.08],
    [-0.12, 0.08],
    [0, -0.14]
  ])
    cyl(g, [0.025, 0.025], 0.03, { tint: '#222222', rough: 0.6 }, [x, 0.015, z], 10);
  // 床のホースは 2 台のうち片方だけ
  if (variant(p) % 2) return;
  const coil = new THREE.CatmullRomCurve3(
    Array.from({ length: 30 }, (_, k) => {
      const a = k * 0.5;
      const d = 0.08 + k * 0.006;
      return new THREE.Vector3(0.35 + Math.cos(a) * d, 0.02, Math.sin(a) * d);
    })
  );
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(coil, 90, 0.018, 6),
    finish({ tint: '#3a8ee6', rough: 0.4 }, [1, 1])
  );
  hose.receiveShadow = true;
  g.add(hose);
}

function jerrycan(g: THREE.Group) {
  box(g, [0.3, 0.33, 0.15], { tint: '#b8231e', rough: 0.45 }, [0, 0.165, 0]);
  box(g, [0.14, 0.04, 0.04], { tint: '#b8231e', rough: 0.45 }, [-0.04, 0.35, 0]);
  cyl(g, [0.025, 0.025], 0.05, { tint: '#d9b21f', rough: 0.4 }, [0.1, 0.355, 0], 12);
}

/** 青いポスター（本家の「ISONAL」）。字は太い白い帯（4cm 以上） */
function isonal(): Pattern {
  return make('isonal', 256, 342, [0.6, 0.8], (g) => {
    g.fillStyle = '#e9edf2';
    g.fillRect(0, 0, 256, 342);
    g.fillStyle = '#1f4fb0';
    g.fillRect(16, 16, 224, 250);
    g.fillStyle = '#f4f6fa';
    g.beginPath();
    g.moveTo(40, 240);
    g.lineTo(150, 40);
    g.lineTo(190, 60);
    g.lineTo(90, 250);
    g.fill();
    g.fillStyle = '#1f4fb0';
    g.fillRect(28, 284, 200, 34);
  });
}

function posterBlue(g: THREE.Group) {
  plane(g, [0.6, 0.8], { pattern: isonal(), rough: 0.9 }, [0, 0, 0.01]);
}

export const LAUNDRY_MAKERS = {
  beam,
  'tube-light': tubeLight,
  clothesline,
  towels,
  'towel-table': towelTable,
  'wood-shelf': woodShelf,
  extinguisher,
  vacuum,
  jerrycan,
  'poster-blue': posterBlue
} satisfies Partial<Record<Kind, Maker>>;
