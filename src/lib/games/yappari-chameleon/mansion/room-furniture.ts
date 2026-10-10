import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import { finish, type Finish } from '../textures';
import { hunterSign } from '../textures-rooms';
import type { Kind, Piece } from './layout';
import { ball, box, copy, cyl, glowing, plane, variant, WHITE, WOOD, type Maker } from './shapes';

/** 縁は乗っている人がいるあいだ光る輪で、build が userData.glow で拾う */
function podium(g: THREE.Group) {
  cyl(g, [1.2, 1.2], 0.3, { tint: '#c8231e', rough: 0.55 }, [0, 0.15, 0], 64);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.19, 64),
    finish({ pattern: hunterSign(), rough: 0.6 }, [2.4, 2.4])
  );
  // 南（始める場所の側）から北を向いて読める向きにする。円の上は −z へ向くので z まわりにも回す
  top.rotation.set(-Math.PI / 2, 0, Math.PI);
  top.position.y = 0.302;
  top.receiveShadow = true;
  g.add(top);
  // 消えているときは台と同じ赤にして、点いたときの黄色い光との差で乗っているのが分かるようにする
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 10, 96), glowing('#c8231e', '#ffd36b', 0, 0.55));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  rim.userData.glow = true;
  g.add(rim);
}

/** 本家のロビーの端の水色の台 */
function pedestal(g: THREE.Group) {
  box(g, [0.9, 0.9, 0.9], { tint: '#7fd1e8', rough: 0.4 }, [0, 0.45, 0]);
  cyl(g, [0.22, 0.24], 0.1, { tint: '#2f9ec7', rough: 0.3 }, [0, 0.95, 0]);
}

const STEEL: Finish = { tint: '#c9ced3', metal: 0.8, rough: 0.35 };
const BRASS: Finish = { tint: '#b8933a', metal: 0.9, rough: 0.35 };

function post(g: THREE.Group) {
  box(g, [0.35, 4, 0.35], WOOD, [0, 2, 0]);
  const foot = box(g, [0.45, 0.12, 0.45], WOOD, [0, 0.06, 0]);
  copy(g, foot, [0, 3.94, 0]);
}

/** 両袖の机と、緑の笠のバンカーズランプ（笠は横に寝かせた半分の筒） */
function desk(g: THREE.Group) {
  box(g, [1.6, 0.05, 0.8], WOOD, [0, 0.735, 0]);
  for (const x of [-0.6, 0.6]) box(g, [0.36, 0.71, 0.72], WOOD, [x, 0.355, 0]);
  cyl(g, [0.07, 0.08], 0.02, BRASS, [0.35, 0.77, -0.15]);
  cyl(g, [0.012, 0.012], 0.32, BRASS, [0.35, 0.93, -0.15]);
  const glass = glowing('#5fae3a', '#8fd14f', 1.0, 0.3);
  glass.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24, 1, true, 0, Math.PI), glass);
  shade.rotation.z = Math.PI / 2;
  shade.position.set(0.35, 1.1, -0.15);
  g.add(shade);
}

function globe(g: THREE.Group) {
  cyl(g, [0.16, 0.22], 0.06, WOOD, [0, 0.03, 0]);
  cyl(g, [0.03, 0.04], 0.55, WOOD, [0, 0.33, 0]);
  ball(g, 0.25, { tint: '#2f6fa8', rough: 0.5 }, [0, 0.85, 0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 48), finish(BRASS, [1, 1]));
  ring.position.y = 0.85;
  ring.rotation.z = 0.41;
  g.add(ring);
  // 大陸は平たくした緑の球を球の面に貼る
  for (const [a, b, s] of [
    [0.3, 0.2, 0.09],
    [1.6, -0.3, 0.12],
    [2.7, 0.5, 0.08],
    [4.2, 0.1, 0.1],
    [5.3, -0.5, 0.07]
  ]) {
    const land = ball(g, s, { tint: '#5d9a43', rough: 0.6 }, [
      Math.cos(a) * Math.cos(b) * 0.245,
      0.85 + Math.sin(b) * 0.245,
      Math.sin(a) * Math.cos(b) * 0.245
    ]);
    land.scale.set(1, 1, 0.25);
    // 組み立てるあいだ g は原点にあるので、lookAt の世界の座標は g の中の座標と同じ
    land.lookAt(0, 0.85, 0);
  }
}

function bust(g: THREE.Group) {
  const stone: Finish = { tint: '#e9e4da', rough: 0.4 };
  // marble() は床の模様で目地の黒い菱形が台の角に出るので、無地の石にする
  box(g, [0.45, 1.1, 0.45], { tint: '#ddd5c8', rough: 0.25 }, [0, 0.55, 0]);
  box(g, [0.36, 0.05, 0.36], { tint: '#cfc6b8', rough: 0.25 }, [0, 1.125, 0]);
  const chest = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0.09, 0],
        [0.16, 0.06],
        [0.19, 0.16],
        [0.17, 0.22],
        [0.06, 0.25]
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      20
    ),
    finish(stone, [1, 0.25])
  );
  chest.position.y = 1.15;
  chest.scale.z = 0.6;
  chest.castShadow = chest.receiveShadow = true;
  g.add(chest);
  cyl(g, [0.05, 0.06], 0.1, stone, [0, 1.43, 0]);
  ball(g, 0.11, stone, [0, 1.55, 0]).scale.set(0.85, 1.05, 0.95);
  box(g, [0.03, 0.05, 0.04], stone, [0, 1.54, 0.105]);
}

/** 2 点のあいだに細い管を渡す */
function pipe(g: THREE.Group, a: V3, b: V3, f: Finish) {
  const [from, to] = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
  const dir = to.clone().sub(from);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, dir.length(), 8), finish(f, [0.09, dir.length()]));
  o.position.copy(from).add(to).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  o.castShadow = o.receiveShadow = true;
  g.add(o);
}

/**
 * 日本のパイプ椅子。前脚は 1 本の管が床から背もたれまで通り、座面は前脚の枠につく。後脚は約 20 度うしろへ開く。
 * 後脚の先まで含めて当たりの幅（0.45m 四方）に収める
 */
function foldingChair(g: THREE.Group) {
  const seat: Finish = { tint: '#151515', metal: 0.3, rough: 0.4 };
  const tube: Finish = { tint: '#1c1c1e', metal: 0.6, rough: 0.35 };
  box(g, [0.42, 0.04, 0.34], seat, [0, 0.46, 0.03]);
  const back = box(g, [0.42, 0.2, 0.03], seat, [0, 0.74, -0.075]);
  back.rotation.x = -0.3;
  for (const x of [-0.19, 0.19]) {
    pipe(g, [x, 0, 0.17], [x, 0.85, -0.1], tube);
    pipe(g, [x, 0.44, -0.02], [x, 0, -0.2], tube);
  }
  box(g, [0.38, 0.02, 0.02], tube, [0, 0.2, 0.17 - (0.27 * 0.2) / 0.85]);
}

function bookPile(g: THREE.Group, p: Piece) {
  const colors = ['#7a1f2b', '#2f4f6f', '#3e5b3a', '#b87333', '#d8c39a'];
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const h = 0.07 + (i % 2) * 0.02;
    const book = box(g, [0.36 - i * 0.03, h, 0.26 - i * 0.015], { tint: colors[(variant(p) + i) % 5], rough: 0.7 }, [
      0,
      y + h / 2,
      0
    ]);
    book.rotation.y = i % 2 ? 0.12 : -0.08;
    y += h;
  }
}

function plates(g: THREE.Group) {
  const plate = cyl(g, [0.12, 0.1], 0.016, WHITE, [-0.18, 0.008, 0], 24);
  for (const [x, n] of [
    [-0.18, 9],
    [0.12, 6]
  ])
    for (let i = x === -0.18 ? 1 : 0; i < n; i++) copy(g, plate, [x, 0.008 + i * 0.018, 0]);
}

/** 天井のダクト。置いた向きの z へ 6m 伸びる。当たらない */
function duct(g: THREE.Group) {
  box(g, [0.6, 0.4, 6], { tint: '#b9bec3', metal: 0.7, rough: 0.4 }, [0, 0, 0]);
  const band = box(g, [0.64, 0.44, 0.05], { tint: '#9aa0a6', metal: 0.7, rough: 0.4 }, [0, 0, -2.8]);
  for (let k = -1; k <= 2; k++) copy(g, band, [0, 0, k * 1.4]);
}

/** 島の台のまわりの床の黄色の注意線（1.4 × 2.8 の枠）。当たらない */
function caution(g: THREE.Group) {
  const yellow: Finish = { tint: '#f2c200', rough: 0.6 };
  for (const [w, d, x, z] of [
    [1.4, 0.08, 0, -1.36],
    [1.4, 0.08, 0, 1.36],
    [0.08, 2.8, -0.66, 0],
    [0.08, 2.8, 0.66, 0]
  ])
    plane(g, [w, d], yellow, [x, 0.004, z], -Math.PI / 2);
}

function cardboard(g: THREE.Group) {
  box(g, [0.6, 0.45, 0.45], { tint: '#b98a53', rough: 0.9 }, [0, 0.225, 0]);
  box(g, [0.6, 0.005, 0.07], { tint: '#d9c08a', rough: 0.6 }, [0, 0.453, 0]);
}

function bucket(g: THREE.Group, p: Piece) {
  const tint = variant(p) % 2 ? '#3f7ec7' : '#d9473b';
  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.12, 0.3, 24, 1, true),
    finish({ tint, rough: 0.5 }, [0.9, 0.3])
  );
  side.material.side = THREE.DoubleSide;
  side.position.y = 0.15;
  side.castShadow = side.receiveShadow = true;
  g.add(side);
  cyl(g, [0.12, 0.12], 0.01, { tint, rough: 0.5 }, [0, 0.005, 0]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 6, 24, Math.PI), finish(STEEL, [1, 1]));
  handle.position.y = 0.3;
  g.add(handle);
}

/** ドラム式洗濯機。並べたときに赤と黄色が交互になるよう、置いた場所から色を決める。前（+z）に丸い扉 */
function washer(g: THREE.Group, p: Piece) {
  const yellow = Math.abs(Math.round((p.at[0] + p.at[2]) / 0.8)) % 2 === 1;
  box(g, [0.65, 0.85, 0.65], { tint: yellow ? '#e9b81f' : '#c9302c', rough: 0.35 }, [0, 0.425, 0]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.03, 10, 40),
    finish({ tint: '#d9dde0', metal: 0.7, rough: 0.3 }, [1, 1])
  );
  ring.position.set(0, 0.42, 0.326);
  g.add(ring);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.19, 32),
    finish({ tint: '#2a3a46', metal: 0.2, rough: 0.1 }, [0.4, 0.4])
  );
  glass.position.set(0, 0.42, 0.327);
  g.add(glass);
  box(g, [0.6, 0.08, 0.02], { tint: '#f1ece2', rough: 0.5 }, [0, 0.78, 0.33]);
}

/** 青い洗濯カート。上の開いた箱に脚と車輪 */
function cart(g: THREE.Group) {
  const blue: Finish = { tint: '#2f6fb8', rough: 0.5 };
  box(g, [0.8, 0.04, 0.55], blue, [0, 0.32, 0]);
  for (const z of [0.26, -0.26]) box(g, [0.8, 0.55, 0.03], blue, [0, 0.6, z]);
  for (const x of [0.385, -0.385]) box(g, [0.03, 0.55, 0.55], blue, [x, 0.6, 0]);
  for (const x of [-0.36, 0.36])
    for (const z of [-0.24, 0.24]) {
      box(g, [0.03, 0.3, 0.03], STEEL, [x, 0.17, z]);
      cyl(g, [0.04, 0.04], 0.03, { tint: '#222222', rough: 0.6 }, [x, 0.04, z], 12).rotation.x = Math.PI / 2;
    }
}

export const ROOM_MAKERS = {
  podium,
  pedestal,
  post,
  desk,
  globe,
  bust,
  'folding-chair': foldingChair,
  'book-pile': bookPile,
  plates,
  duct,
  caution,
  box: cardboard,
  bucket,
  washer,
  cart
} satisfies Partial<Record<Kind, Maker>>;
