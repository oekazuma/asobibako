import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import { checker, coffer, damask, finish, marble, wainscot, woodPanel, type Finish } from '../textures';
import type { Level } from '../move';
import { artwork, blueHex, brick, planks, splashCeiling, splashFloor, splashWall, whiteTile } from '../textures-rooms';
import type { Built } from '../world3d';
import { seeThrough } from '../xray';
import { piece } from './furniture';
import { levelOf, mansion, type Face, type Mat, type Piece, type Slab } from './layout';
import { inLobby } from './lobby';
import { mergeStatic } from './merge';
import { moodAt } from './moods';
import { ART } from './props';

const LOOKS: Record<Mat, () => Finish> = {
  woodPanel: () => ({ pattern: woodPanel(), rough: 0.6 }),
  marble: () => ({ pattern: marble(), rough: 0.25 }),
  coffer: () => ({ pattern: coffer(), rough: 0.7 }),
  checker: () => ({ pattern: checker(), rough: 0.5 }),
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
  blueHex: () => ({ pattern: blueHex(), rough: 0.5 }),
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

const mid = (s: Slab): V3 => [(s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2];

function slab(s: Slab): THREE.Mesh {
  const size = [0, 1, 2].map((i) => s.max[i] - s.min[i]) as [number, number, number];
  const faceSize = (f: Face): [number, number] =>
    f[0] === 'x' ? [size[2], size[1]] : f[0] === 'y' ? [size[0], size[2]] : [size[0], size[1]];
  const plain = finish({ tint: '#3b2414', rough: 0.7 }, [1, 1]);
  const look = (f: Face) => {
    const mat = f === s.face ? s.mat : f === OPPOSITE[s.face] ? s.back : undefined;
    if (!mat) return plain;
    const m = finish(LOOKS[mat](), faceSize(f));
    // 合わせるのは裏のある（戸口で分けた）壁だけ。1 枚で張った面には継ぎ目が無いので、部屋の端から模様を始める
    if (s.back) anchor(m, f, s);
    return m;
  };
  const mats = ORDER.map(look);
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), mats);
  o.position.set(...mid(s));
  o.receiveShadow = true;
  // 天井と壁は上からの 1 灯を遮らない（遮ると廊下が真っ暗になる）
  o.castShadow = s.shadow ?? false;
  return o;
}

function put(o: THREE.Object3D, p: Piece) {
  o.position.set(...p.at);
  o.rotation.y = (p.turn * Math.PI) / 2;
}

export function buildMansion(): Built {
  const m = mansion();
  const group = new THREE.Group();
  // まとめた 1 つの Mesh がロビーと屋敷にまたがると、どちらにいても両方を描くので、別々にまとめる
  const house = new THREE.Group();
  const lobby = new THREE.Group();
  group.add(house, lobby);
  const side = (at: V3) => (inLobby(at) ? lobby : house);
  // 床の箱は床の下へ 1m あり、真ん中ではロビーの外になるので、上の角で見る
  for (const s of m.slabs) side(s.max).add(slab(s));
  const first = m.pieces.length - m.moving;
  const objects = m.pieces.map((p, i) => {
    const o = piece(p);
    // 動く物は種を変えるたびに置き直すので屋敷のまとめから外し（下の keep）、物の中の部品だけをまとめる
    if (i >= first) mergeStatic(o, () => false);
    put(o, p);
    side(p.at).add(o);
    return o;
  });
  for (const l of m.lights) {
    const light = new THREE.PointLight(l.color, l.power, l.reach, 2);
    light.position.set(...l.at);
    group.add(light);
  }
  const rims: THREE.MeshStandardMaterial[] = [];
  group.traverse((o) => {
    if (o.userData.glow) rims.push((o as THREE.Mesh).material as THREE.MeshStandardMaterial);
  });
  const frames: THREE.Mesh[] = [];
  m.pieces.forEach((p, i) => {
    if (p.kind === 'painting')
      objects[i].traverse((o) => {
        if (o.userData.art) frames.push(o as THREE.Mesh);
      });
  });
  // 絵柄は紹介の 3 秒に差し替えるので、材質を先に全部作り、透かしのシェーダーも先に当てて、差し替えでシェーダーを作り直させない
  const arts = Array.from({ length: ART }, (_, k) => {
    const mat = finish({ pattern: artwork(k), rough: 0.6 }, [1.2, 0.9]);
    seeThrough(mat);
    return mat;
  });
  const moving = new Set<THREE.Object3D>(objects.slice(first));
  for (const g of [house, lobby]) mergeStatic(g, (o) => moving.has(o) || !!o.userData.art || !!o.userData.glow);
  const arrange = (seed: number | null): Level => {
    const next = mansion(seed);
    next.pieces.slice(first).forEach((p, i) => put(objects[first + i], p));
    next.arts.forEach((k, i) => {
      if (frames[i]) frames[i].material = arts[k];
    });
    return levelOf(next);
  };
  return {
    group,
    level: arrange(null),
    glow: (on) => {
      for (const r of rims) r.emissiveIntensity = on ? 3 : 0;
    },
    mood: moodAt,
    arrange
  };
}
