import * as THREE from 'three';
import { RANK_COLOR } from './contest';
import type { RoomLook, RoomTheme } from './decor';
import { CONTEST_IDS } from './engine';
import { ROOM } from './layout';
import { box, cyl, geo, mat, mesh, torus } from './props';
import { petBed, plant, rugOf, sofa, wallDecor, windowDressing } from './room-furniture';
import { floorMap, outside, wainscot, wallpaper } from './room-textures';
import { release, rounded } from './scenes';
import { fabric, paint, planks } from './textures';
import type { ContestId } from './types';

/**
 * 部屋。壁・床・窓はテーマ（RoomLook）の部位ごとに組み替える。ライトは world3d が置く。
 * 床・壁は影を受けるだけにする（背の高い壁が影を落とすと、光の向きによっては床が真っ暗になる）
 */

/** 窓枠の色。窓の外の景色は view の部位、枠は壁の部位に合わせる */
const FRAME: Record<RoomTheme, string> = {
  natural: '#f4f1ea',
  pink: '#ffffff',
  wafu: '#b08d5e',
  nordic: '#f4f1ea',
  castle: '#efe2c4'
};

function windowFrame(width: number, height: number, look: RoomLook, weave: THREE.Texture) {
  const g = new THREE.Group();
  // 窓の外は照明もトーンマップも通さず、そのままの明るさで見せる
  const view = new THREE.MeshBasicMaterial({ map: outside(look.view), toneMapped: false });
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(width, height), view));
  const white = mat(FRAME[look.wall], { roughness: 0.5 });
  const t = 0.07;
  g.add(mesh(rounded(width + t, t, 0.06, 0.012), white, 0, height / 2, 0.02, false));
  g.add(mesh(rounded(width + t * 2.6, t * 1.2, 0.12, 0.015), white, 0, -height / 2, 0.04, false));
  for (const s of [-1, 1]) g.add(mesh(rounded(t, height, 0.06, 0.012), white, (s * width) / 2, 0, 0.02, false));
  g.add(mesh(rounded(0.035, height, 0.04, 0.008), white, 0, 0, 0.02, false));
  g.add(mesh(rounded(width, 0.035, 0.04, 0.008), white, 0, height * 0.1, 0.02, false));
  g.add(windowDressing(look.curtain, width, height, weave));
  return g;
}

const WALL = { back: -2.45, side: 1.8, front: 2.6, height: 2.6 };
const SIDE_WINDOW = { z: -1.0, y: 1.3, w: 1.2, h: 1.1 };

/**
 * 横の窓から床へ落ちる日だまり。壁に影を落とさせないかわりに、窓の形を日の向きで床へ写した明るい面を重ねる。
 * 平行な光なので、窓の四隅を床へ写した四角形に窓の絵をそのまま貼れば形が合う
 */
function sunPatch(sun: THREE.Vector3) {
  const map = paint(256, 256, (g) => {
    g.filter = 'blur(5px)';
    g.fillStyle = '#ffffff';
    const m = 14;
    const midX = 128;
    // 窓の横桟は中心より高さの 1 割上にある
    const midY = 0.4 * 256;
    for (const [x0, x1] of [
      [m, midX - 5],
      [midX + 5, 256 - m]
    ])
      for (const [y0, y1] of [
        [m, midY - 5],
        [midY + 5, 256 - m]
      ])
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
  });
  const corner = (u: number, v: number) => {
    const y = SIDE_WINDOW.y + (v - 0.5) * SIDE_WINDOW.h;
    const z = SIDE_WINDOW.z + (u - 0.5) * SIDE_WINDOW.w;
    const k = y / sun.y;
    return [-WALL.side - sun.x * k, 0.012, z - sun.z * k];
  };
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)].flat(), 3)
  );
  geom.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geom.setIndex([0, 1, 2, 2, 1, 3]);
  const m = new THREE.MeshBasicMaterial({
    map,
    color: '#ffd9a0',
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3
  });
  const patch = new THREE.Mesh(geom, m);
  patch.renderOrder = 2;
  return patch;
}

const SHELF = { w: 0.96, h: 0.64, d: 0.3, t: 0.025 };

/**
 * 窓の下の低い棚。コンテストで 1 位をとった階級のトロフィーを、上の階級から順に並べる。
 * 下の段の右には本を立てて、トロフィーが少ないうちもさびしく見えないようにする
 */
/** 棚の塗り。壁のテーマに合わせる（ピンクの部屋に茶色の棚だと浮く） */
const SHELF_COLOR: Record<RoomTheme, [string, string]> = {
  natural: ['#8a5a36', '#6e452a'],
  pink: ['#fff6f8', '#f7d7e1'],
  wafu: ['#6b4a2e', '#553a22'],
  nordic: ['#d9c29e', '#c7ad86'],
  castle: ['#4a2c1c', '#3a2216']
};

function trophyShelf(trophies: Partial<Record<ContestId, number>>, theme: RoomTheme) {
  const g = new THREE.Group();
  const [paintColor, backColor] = SHELF_COLOR[theme];
  const wood = mat(paintColor, { roughness: 0.6 });
  const { w, h, d, t } = SHELF;
  for (const y of [t / 2, h / 2 - 0.01, h - t / 2]) g.add(mesh(rounded(w, t, d, 0.006), wood, 0, y, 0));
  for (const s of [-1, 1]) g.add(mesh(rounded(t, h, d, 0.006), wood, (s * (w - t)) / 2, h / 2, 0));
  g.add(mesh(box(w, h, 0.01), mat(backColor, { roughness: 0.7 }), 0, h / 2, -d / 2 + 0.005, false));
  const books = ['#3f5f8a', '#a8453a', '#e0c36a', '#5d7d52'];
  books.forEach((c, i) => {
    const bh = 0.2 + (i % 2) * 0.04;
    const b = mesh(box(0.035, bh, 0.19), mat(c, { roughness: 0.8 }), w / 2 - 0.06 - i * 0.04, t + bh / 2, 0.01);
    if (i === 3) b.rotation.z = 0.18;
    g.add(b);
  });
  const list = CONTEST_IDS.flatMap((id) => Array.from({ length: trophies[id] ?? 0 }, (_, rank) => rank)).sort(
    (a, b) => b - a
  );
  list.forEach((rank, i) => {
    const top = i < 10;
    const k = top ? i : i - 10;
    const cup = trophy(rank);
    // 上の段は、よいものから右（部屋のまん中の側）に並べる。棚の左はしは画面の外に切れやすい。
    // 下の段は右に本があるので、左からつめて並べる
    const x = top ? w / 2 - 0.07 - k * 0.088 : -w / 2 + 0.07 + k * 0.07;
    cup.position.set(x, top ? h : h / 2 - 0.01 + t / 2, 0.02);
    cup.rotation.y = (k % 2 ? 0.25 : -0.25) + 0.1;
    g.add(cup);
  });
  return g;
}

/** 金属の優勝カップ。上の階級ほど大きく、チャンピオンは虹色に光る */
function trophy(rank: number) {
  const g = new THREE.Group();
  const color = RANK_COLOR[rank];
  const metal =
    rank === 4
      ? mat(color, { metalness: 0.7, roughness: 0.15 }, { iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 })
      : mat(color, { metalness: 0.9, roughness: 0.28 });
  const cupShape = geo('trophy-cup', () => {
    const pts = [
      [0, 0],
      [0.012, 0.004],
      [0.03, 0.022],
      [0.04, 0.05],
      [0.042, 0.075],
      [0.038, 0.076]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 24);
  });
  const s = 1 + rank * 0.09;
  g.add(mesh(box(0.06, 0.018, 0.06), mat('#3a2a20', { roughness: 0.5 }), 0, 0.009, 0));
  g.add(mesh(cyl(0.016, 0.022, 0.012, 16), metal, 0, 0.024, 0));
  g.add(mesh(cyl(0.006, 0.008, 0.04, 10), metal, 0, 0.05, 0));
  g.add(mesh(cupShape, metal, 0, 0.068, 0));
  for (const side of [-1, 1]) {
    g.add(mesh(torus(0.017, 0.0035, 6, 16), metal, side * 0.042, 0.115, 0));
  }
  g.scale.setScalar(s);
  return g;
}

/** 壁の見た目。dado は腰板の高さ（0 でなし）、accent は奥の壁だけの色 */
const WALLS: Record<RoomTheme, { color: string; accent?: string; trim: string; dado: number; rail?: string }> = {
  natural: { color: '#eee8de', trim: '#f7f4ee', dado: 0 },
  pink: { color: '#ffffff', trim: '#ffffff', dado: 0.66, rail: '#ffffff' },
  wafu: { color: '#ffffff', trim: '#5e3f25', dado: 0.66, rail: '#6b4a2e' },
  nordic: { color: '#f3f1ec', accent: '#a9b7ba', trim: '#f4f1ea', dado: 0 },
  castle: { color: '#ffffff', trim: '#3a2216', dado: 0.66, rail: '#d8a94a' }
};

/** 繰り返しの 1 枚を tile メートルにそろえる。面ごとに大きさが違うので texture の repeat ではなく uv を伸ばす */
function tiled(geometry: THREE.BufferGeometry, w: number, h: number, tile: number) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return geometry;
}

const NORDIC_WOOD = ['#dcc6a3', '#d4bb95', '#e2cfae', '#cfb68f', '#d9c29e'];

function floorMaterial(theme: RoomTheme): { material: THREE.MeshStandardMaterial; tile: number } {
  if (theme === 'natural' || theme === 'nordic') {
    const wood = theme === 'natural' ? planks() : planks(NORDIC_WOOD, 6);
    return {
      tile: 1.2,
      material: new THREE.MeshStandardMaterial({ map: wood.map, roughnessMap: wood.roughness, roughness: 1 })
    };
  }
  const { map, tile } = floorMap(theme);
  const material =
    theme === 'castle'
      ? new THREE.MeshStandardMaterial({ map, roughness: 0.16, envMapIntensity: 3 })
      : new THREE.MeshStandardMaterial({ map, roughness: theme === 'pink' ? 0.55 : 0.85 });
  return { material, tile };
}

function walls(group: THREE.Group, theme: RoomTheme) {
  const spec = WALLS[theme];
  const depth = WALL.front - WALL.back;
  const { map, tile } = wallpaper(theme);
  const paper = new THREE.MeshStandardMaterial({ color: spec.color, map, roughness: 0.95 });
  const back = new THREE.Mesh(
    tiled(new THREE.PlaneGeometry(WALL.side * 2, WALL.height), WALL.side * 2, WALL.height, tile),
    spec.accent ? new THREE.MeshStandardMaterial({ color: spec.accent, map, roughness: 0.95 }) : paper
  );
  back.position.set(0, WALL.height / 2, WALL.back);
  back.receiveShadow = true;
  group.add(back);
  const trim = mat(spec.trim, { roughness: 0.45 });
  const sideZ = (WALL.back + WALL.front) / 2;
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(tiled(new THREE.PlaneGeometry(depth, WALL.height), depth, WALL.height, tile), paper);
    side.rotation.y = -s * (Math.PI / 2);
    side.position.set(s * WALL.side, WALL.height / 2, sideZ);
    side.receiveShadow = true;
    group.add(side);
    group.add(mesh(rounded(0.025, 0.12, depth, 0.008), trim, s * (WALL.side - 0.012), 0.06, sideZ, false));
  }
  group.add(mesh(rounded(WALL.side * 2, 0.12, 0.025, 0.008), trim, 0, 0.06, WALL.back + 0.012, false));
  if (spec.dado) {
    const h = spec.dado;
    const panel = new THREE.MeshStandardMaterial({ map: wainscot(theme), roughness: theme === 'castle' ? 0.5 : 0.7 });
    const rail = mat(spec.rail!, theme === 'castle' ? { metalness: 0.85, roughness: 0.3 } : { roughness: 0.5 });
    // 腰板の 1 枚は幅が高さの 2 倍の絵
    const board = (len: number) => tiled(new THREE.PlaneGeometry(len, h), len, 1, h * 2);
    const b = new THREE.Mesh(board(WALL.side * 2), panel);
    b.position.set(0, h / 2, WALL.back + 0.006);
    b.receiveShadow = true;
    group.add(b, mesh(rounded(WALL.side * 2, 0.045, 0.03, 0.01), rail, 0, h, WALL.back + 0.015, false));
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(board(depth), panel);
      p.rotation.y = -s * (Math.PI / 2);
      p.position.set(s * (WALL.side - 0.006), h / 2, sideZ);
      p.receiveShadow = true;
      group.add(p, mesh(rounded(0.03, 0.045, depth, 0.01), rail, s * (WALL.side - 0.015), h, sideZ, false));
    }
  }
  if (theme === 'wafu') {
    // 柱と長押。部屋の角と窓の上を横に通る木で、和室の骨組みに見せる
    const post = mat('#6b4a2e', { roughness: 0.55 });
    for (const s of [-1, 1])
      group.add(
        mesh(box(0.11, WALL.height, 0.11), post, s * (WALL.side - 0.05), WALL.height / 2, WALL.back + 0.05, false)
      );
    group.add(mesh(box(WALL.side * 2, 0.1, 0.06), post, 0, 2.0, WALL.back + 0.03, false));
    for (const s of [-1, 1]) group.add(mesh(box(0.06, 0.1, depth), post, s * (WALL.side - 0.03), 2.0, sideZ, false));
  }
}

export function buildRoom(
  sun: THREE.Vector3,
  trophies: Partial<Record<ContestId, number>>,
  look: RoomLook
): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const weave = fabric();

  const depth = WALL.front - WALL.back;
  const { material, tile } = floorMaterial(look.floor);
  const floor = new THREE.Mesh(
    tiled(new THREE.PlaneGeometry(WALL.side * 2, depth), WALL.side * 2, depth, tile),
    material
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (WALL.back + WALL.front) / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const carpet = rugOf(look.rug);
  carpet.position.set(0, 0, -0.3);
  group.add(carpet);

  walls(group, look.wall);

  const win = windowFrame(1.0, 1.1, look, weave);
  win.position.set(-1.0, 1.3, WALL.back + 0.005);
  group.add(win);
  const side = windowFrame(SIDE_WINDOW.w, SIDE_WINDOW.h, look, weave);
  side.rotation.y = Math.PI / 2;
  side.position.set(-WALL.side + 0.005, SIDE_WINDOW.y, SIDE_WINDOW.z);
  group.add(side);
  // 夜空の窓から日だまりが落ちるとおかしい
  if (look.view !== 'castle') group.add(sunPatch(sun));

  const couch = sofa(look.sofa, weave);
  couch.position.set(ROOM.sofa.x, 0, ROOM.sofa.z);
  // 名前は Perch の id。タップした家具を world3d が名前で探す
  couch.name = 'sofa';
  group.add(couch);
  const decor = wallDecor(look.wall);
  decor.position.set(0.2, 0, WALL.back);
  group.add(decor);

  const pot = plant();
  pot.position.set(ROOM.blocks[2].x, 0, ROOM.blocks[2].z);
  group.add(pot);

  const bed = petBed(look.bed, weave);
  bed.position.set(ROOM.bed.x, 0, ROOM.bed.z);
  bed.name = 'bed';
  group.add(bed);

  // ペットは奥の壁ぎわ（bounds の外）まで来ないので、棚に当たりは付けない
  const shelf = trophyShelf(trophies, look.wall);
  shelf.position.set(-1.05, 0, WALL.back + 0.17);
  group.add(shelf);

  const matMap = paint(128, 256, (g) => {
    g.fillStyle = '#9cc7d6';
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = '#eef6f8';
    g.lineWidth = 4;
    g.strokeRect(10, 10, 108, 236);
  });
  const placemat = mesh(
    rounded(0.42, 0.006, 0.84, 0.003),
    new THREE.MeshStandardMaterial({ map: matMap, roughness: 0.55 }),
    ROOM.food.x,
    0.003,
    (ROOM.food.z + ROOM.water.z) / 2,
    false
  );
  group.add(placemat);

  return { group, dispose: () => release(group) };
}
