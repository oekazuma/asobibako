import * as THREE from 'three';
import { checker, coffer, damask, finish, marble, wainscot, woodPanel, type Finish } from '../textures';
import { blueHex, brick, planks, splashCeiling, splashFloor, splashWall, whiteTile } from '../textures-rooms';
import type { Built } from '../world3d';
import { piece } from './furniture';
import { levelOf, mansion, type Face, type Mat, type Slab } from './layout';
import { inLobby } from './lobby';

const LOOKS: Record<Mat, () => Finish> = {
  woodPanel: () => ({ pattern: woodPanel(), rough: 0.6 }),
  marble: () => ({ pattern: marble(), rough: 0.25 }),
  coffer: () => ({ pattern: coffer(), rough: 0.7 }),
  checker: () => ({ pattern: checker(), rough: 0.35 }),
  greenDamask: () => ({ pattern: damask('#26330a', '#86a63a'), rough: 0.8 }),
  wainscot: () => ({ pattern: wainscot(), rough: 0.55 }),
  cream: () => ({ tint: '#efe6d2', rough: 0.85 }),
  rail: () => ({ tint: '#3b2414', rough: 0.5 }),
  white: () => ({ tint: '#f2efe9', rough: 0.85 }),
  splash: () => ({ pattern: splashWall(), rough: 0.85 }),
  splashFloor: () => ({ pattern: splashFloor(), rough: 0.8 }),
  splashCeiling: () => ({ pattern: splashCeiling(), rough: 0.85 }),
  planks: () => ({ pattern: planks(), rough: 0.55 }),
  whiteTile: () => ({ pattern: whiteTile(), rough: 0.3 }),
  blueHex: () => ({ pattern: blueHex(), rough: 0.35 }),
  brick: () => ({ pattern: brick(), rough: 0.9 })
};

/** BoxGeometry の材質の並び（+x, −x, +y, −y, +z, −z） */
const ORDER: Face[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];
const OPPOSITE: Record<Face, Face> = { 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+', 'z+': 'z-', 'z-': 'z+' };
/** BoxGeometry の面ごとに、u と v が増える世界の軸と向き */
const AXES: Record<Face, [number, 1 | -1, number, 1 | -1]> = {
  'x+': [2, -1, 1, 1],
  'x-': [2, 1, 1, 1],
  'y+': [0, 1, 2, -1],
  'y-': [0, 1, 2, 1],
  'z+': [0, 1, 1, 1],
  'z-': [0, -1, 1, 1]
};

/** 模様の継ぎ目を世界の位置に合わせる。戸口で分けた壁の、戸口の上と横、腰板の上下で模様がずれないように */
function anchor(m: THREE.MeshStandardMaterial, f: Face, s: Slab) {
  const t = m.map;
  if (!t) return;
  const [u, su, v, sv] = AXES[f];
  const at = (i: number, sign: number) => (sign > 0 ? s.min[i] : -s.max[i]) / (s.max[i] - s.min[i]);
  t.offset.set(at(u, su) * t.repeat.x, at(v, sv) * t.repeat.y);
}

function slab(s: Slab): THREE.Mesh {
  const size = [0, 1, 2].map((i) => s.max[i] - s.min[i]) as [number, number, number];
  const faceSize = (f: Face): [number, number] =>
    f[0] === 'x' ? [size[2], size[1]] : f[0] === 'y' ? [size[0], size[2]] : [size[0], size[1]];
  const plain = finish({ tint: '#3b2414', rough: 0.7 }, [1, 1]);
  const look = (f: Face) => {
    const mat = f === s.face ? s.mat : f === OPPOSITE[s.face] ? s.back : undefined;
    if (!mat) return plain;
    const m = finish(LOOKS[mat](), faceSize(f));
    // 合わせるのは裏のある（戸口で分けた）壁だけ。ほかの面は部屋の端から貼った今の見た目のまま
    if (s.back) anchor(m, f, s);
    return m;
  };
  const mats = ORDER.map(look);
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), mats);
  o.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
  o.receiveShadow = true;
  // 天井と壁は上からの 1 灯を遮らない（遮ると廊下が真っ暗になる）
  o.castShadow = s.shadow ?? false;
  return o;
}

export function buildMansion(): Built {
  const m = mansion();
  const group = new THREE.Group();
  for (const s of m.slabs) group.add(slab(s));
  for (const p of m.pieces) {
    const o = piece(p);
    o.position.set(...p.at);
    o.rotation.y = (p.turn * Math.PI) / 2;
    group.add(o);
  }
  for (const l of m.lights) {
    const light = new THREE.PointLight(l.color, l.power, l.reach, 2);
    light.position.set(...l.at);
    group.add(light);
  }
  const rims: THREE.MeshStandardMaterial[] = [];
  group.traverse((o) => {
    if (o.userData.glow) rims.push((o as THREE.Mesh).material as THREE.MeshStandardMaterial);
  });
  return {
    group,
    level: levelOf(m),
    glow: (on) => {
      for (const r of rims) r.emissiveIntensity = on ? 3 : 0;
    },
    sunless: inLobby
  };
}
