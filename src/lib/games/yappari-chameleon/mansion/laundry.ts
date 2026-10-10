import * as THREE from 'three';
import { rng } from '../rng';
import { finish, make, type Finish, type Pattern } from '../textures';
import type { Kind, Piece } from './layout';
import { box, glowing, variant, type Maker } from './shapes';

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

export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight, clothesline } satisfies Partial<Record<Kind, Maker>>;
