import * as THREE from 'three';
import type { Zone } from './course';
import { box, cyl, mat, mesh, ROAD_W, SEG, sphere } from './models';

/** 場所ごとの空・霧・光の色。景色が変わるたびに、ここへ向かって少しずつ寄せる */
export const MOOD: Record<Zone, { sky: string; fog: string; sun: string; sunI: number; hemi: string; ground: string }> =
  {
    street: { sky: '#8fd0ff', fog: '#cfe9ff', sun: '#fff1d6', sunI: 2.6, hemi: '#e6f4ff', ground: '#b7ae9f' },
    arcade: { sky: '#ffb77a', fog: '#ffd9b0', sun: '#ffd0a0', sunI: 2.0, hemi: '#ffe6c8', ground: '#a88d70' },
    hall: { sky: '#dff3ff', fog: '#eef6fb', sun: '#ffffff', sunI: 1.4, hemi: '#f3f8ff', ground: '#9fb3b8' }
  };

const WALLS = ['#f3ebdf', '#d8e2e6', '#c3d0d8', '#f6e6c8', '#e3d6cf', '#d3d8f0'];

function glow(color: string, strength = 2.2) {
  return mat(color, { emissive: color, emissiveIntensity: strength });
}

/** 道ばたの家。side は道のどちら側か（-1 が左）で、窓とひさしを道の側に付ける */
function house(seed: number, side: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.8 + (seed % 4) * 1.3;
  g.add(mesh(box(4, h, 8.6), WALLS[seed % WALLS.length], 0, h / 2));
  g.add(mesh(box(4.4, 0.3, 9), '#5d6270', 0, h + 0.12));
  for (let row = 0; row < Math.floor((h - 0.6) / 1.6); row++)
    for (const z of [-2.4, 0, 2.4]) {
      const win = mesh(box(0.06, 0.85, 1.25), row % 2 ? '#a9dcff' : '#bfe6ff', -side * 2.01, 1.3 + row * 1.6, z);
      // 壁にはりつく薄い板で影は見えない。窓の数だけ影の描画が増える
      win.castShadow = false;
      g.add(win);
    }
  const awning = mesh(box(0.9, 0.08, 3), seed % 2 ? '#ff6f6f' : '#4fb6ff', -side * 2.4, 2.4, (seed % 3) - 1);
  awning.rotation.z = side * 0.25;
  g.add(awning);
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.16, 1.6), '#8a5a3c', 0, 0.8));
  g.add(mesh(sphere(0.95), '#5cbf6a', 0, 2.1));
  g.add(mesh(sphere(0.65), '#7ad487', 0.35, 2.7, 0.2));
  g.add(mesh(sphere(0.55), '#4fae5d', -0.4, 2.4, -0.3));
  return g;
}

function pole(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.14, 0.18, 6), '#a3a8b0', 0, 3));
  g.add(mesh(box(1.4, 0.1, 0.1), '#8a8f98', 0, 5.4));
  return g;
}

function floor(width: number, color: string) {
  const f = new THREE.Mesh(box(width, 0.1, SEG), mat(color));
  f.position.set(0, -0.05, -SEG / 2);
  f.receiveShadow = true;
  return f;
}

/** 車道・白線・歩道・両側の家と木。原点から -z へ SEG m */
function street(index: number): THREE.Group {
  const g = new THREE.Group();
  g.add(floor(ROAD_W, '#8a9098'));
  for (const x of [-ROAD_W / 2 + 0.25, ROAD_W / 2 - 0.25]) {
    const line = new THREE.Mesh(box(0.12, 0.02, SEG), mat('#ffffff'));
    line.position.set(x, 0.01, -SEG / 2);
    g.add(line);
  }
  for (let z = 2; z < SEG; z += 5) {
    const dash = new THREE.Mesh(box(0.12, 0.02, 2), mat('#f2f2f2'));
    dash.position.set(0, 0.01, -z);
    g.add(dash);
  }
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(box(2.6, 0.2, SEG), mat('#d8d1c4'));
    walk.position.set(side * (ROAD_W / 2 + 1.3), 0.05, -SEG / 2);
    walk.receiveShadow = true;
    g.add(walk);
    const bumps = new THREE.Mesh(box(0.35, 0.21, SEG), mat('#f2c230'));
    bumps.position.set(side * (ROAD_W / 2 + 0.6), 0.05, -SEG / 2);
    g.add(bumps);
    for (const [k, z] of [5, 15].entries()) {
      const h = house(index * 4 + k * 2 + (side > 0 ? 1 : 0), side);
      h.position.set(side * (ROAD_W / 2 + 2.6 + 2.2), 0, -z);
      g.add(h);
    }
    const t = (index + (side > 0 ? 1 : 0)) % 2 ? tree() : pole();
    t.position.set(side * (ROAD_W / 2 + 2.2), 0.1, -10);
    g.add(t);
  }
  return g;
}

const SHOPS = ['#ff8f70', '#ffd166', '#7fd1ae', '#8fb8ff', '#d7a6ff', '#ff9ec8'];

/** 商店街。アーケードの屋根・店先ののれんと看板・ちょうちん（光ってにじむ） */
function arcade(index: number): THREE.Group {
  const g = new THREE.Group();
  g.add(floor(ROAD_W + 5, '#c9b9a3'));
  for (let z = 0; z < SEG; z += 2) {
    const tile = new THREE.Mesh(box(ROAD_W + 5, 0.02, 0.06), mat('#b19f88'));
    tile.position.set(0, 0.01, -z);
    g.add(tile);
  }
  for (const side of [-1, 1]) {
    for (const [k, z] of [5, 15].entries()) {
      const seed = index * 4 + k * 2 + (side > 0 ? 1 : 0);
      const shop = new THREE.Group();
      shop.add(mesh(box(3, 4.6, 9.4), '#efe4d2', 0, 2.3));
      const color = SHOPS[seed % SHOPS.length];
      const front = mesh(box(0.1, 1.9, 7.6), '#3b3144', -side * 1.52, 1.1, 0);
      front.castShadow = false;
      shop.add(front);
      shop.add(mesh(box(0.14, 0.7, 7.8), color, -side * 1.56, 3.4, 0));
      const cloth = mesh(box(0.06, 0.6, 7.2), color, -side * 1.62, 2.55, 0);
      cloth.castShadow = false;
      shop.add(cloth);
      shop.position.set(side * (ROAD_W / 2 + 2.5 + 1.5), 0, -z);
      g.add(shop);
    }
    for (let z = 2; z < SEG; z += 4) {
      const lantern = mesh(sphere(0.28), glow(z % 8 === 2 ? '#ff5a4f' : '#ffb347'), side * (ROAD_W / 2 + 1.2), 3.2, -z);
      lantern.scale.set(1, 1.25, 1);
      lantern.castShadow = false;
      g.add(lantern);
    }
  }
  // アーケードの屋根。光を通す半透明の板を、梁の上に並べる
  for (let z = 0; z < SEG; z += 4) {
    const beam = mesh(box(ROAD_W + 9, 0.18, 0.18), '#6c6f7d', 0, 5.4, -z);
    beam.castShadow = false;
    g.add(beam);
  }
  const roof = new THREE.Mesh(
    box(ROAD_W + 9, 0.05, SEG),
    mat('#fff4e0', { transparent: true, opacity: 0.35, emissive: '#fff1d0', emissiveIntensity: 0.3 })
  );
  roof.position.set(0, 5.6, -SEG / 2);
  g.add(roof);
  const banner = mesh(box(3.2, 0.7, 0.08), glow(SHOPS[index % SHOPS.length], 0.6), 0, 4.4, -10);
  banner.castShadow = false;
  g.add(banner);
  return g;
}

/** 校舎の廊下。床の板・腰壁・窓・ロッカー・天井の明かり（光ってにじむ） */
function hall(index: number): THREE.Group {
  const g = new THREE.Group();
  const half = 2.4;
  g.add(floor(half * 2, '#b9d3c9'));
  for (let z = 0; z < SEG; z += 1.2) {
    const seam = new THREE.Mesh(box(half * 2, 0.02, 0.04), mat('#a3c1b6'));
    seam.position.set(0, 0.01, -z);
    g.add(seam);
  }
  for (const side of [-1, 1]) {
    const wall = mesh(box(0.2, 3.4, SEG), '#f5f1e8', side * (half + 0.1), 1.7, -SEG / 2);
    wall.receiveShadow = true;
    g.add(wall);
    const skirting = mesh(box(0.22, 1.0, SEG), '#7fb7a4', side * (half + 0.09), 0.5, -SEG / 2);
    skirting.castShadow = false;
    g.add(skirting);
    for (let z = 2.5; z < SEG; z += 5) {
      if (side < 0) {
        const win = mesh(box(0.05, 1.4, 3.4), glow('#e6f6ff', 0.9), -half + 0.01, 2.05, -z);
        win.castShadow = false;
        g.add(win);
      } else {
        const locker = mesh(box(0.4, 1.6, 2.4), (index + z) % 2 ? '#8fa6c9' : '#9bb6a8', half - 0.2, 0.8, -z);
        g.add(locker);
      }
    }
  }
  const ceiling = mesh(box(half * 2 + 0.4, 0.15, SEG), '#fbfaf6', 0, 3.45, -SEG / 2);
  ceiling.castShadow = false;
  g.add(ceiling);
  for (let z = 3; z < SEG; z += 5) {
    const light = mesh(box(0.25, 0.06, 1.8), glow('#ffffff', 2.4), 0, 3.35, -z);
    light.castShadow = false;
    g.add(light);
  }
  return g;
}

export function segment(zone: Zone, index: number): THREE.Group {
  return zone === 'arcade' ? arcade(index) : zone === 'hall' ? hall(index) : street(index);
}
