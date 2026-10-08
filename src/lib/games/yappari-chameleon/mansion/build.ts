import * as THREE from 'three';
import { checker, coffer, damask, finish, marble, wainscot, woodPanel, type Finish } from '../textures';
import type { Built } from '../world3d';
import { piece } from './furniture';
import { levelOf, mansion, type Face, type Mat, type Slab } from './layout';

const LOOKS: Record<Mat, () => Finish> = {
  woodPanel: () => ({ pattern: woodPanel(), rough: 0.6 }),
  marble: () => ({ pattern: marble(), rough: 0.25 }),
  coffer: () => ({ pattern: coffer(), rough: 0.7 }),
  checker: () => ({ pattern: checker(), rough: 0.35 }),
  greenDamask: () => ({ pattern: damask('#26330a', '#86a63a'), rough: 0.8 }),
  wainscot: () => ({ pattern: wainscot(), rough: 0.55 }),
  cream: () => ({ tint: '#efe6d2', rough: 0.85 }),
  rail: () => ({ tint: '#3b2414', rough: 0.5 })
};

/** BoxGeometry の材質の並び（+x, −x, +y, −y, +z, −z） */
const ORDER: Face[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

function slab(s: Slab): THREE.Mesh {
  const size = [0, 1, 2].map((i) => s.max[i] - s.min[i]) as [number, number, number];
  const faceSize = (f: Face): [number, number] =>
    f[0] === 'x' ? [size[2], size[1]] : f[0] === 'y' ? [size[0], size[2]] : [size[0], size[1]];
  const plain = finish({ tint: '#3b2414', rough: 0.7 }, [1, 1]);
  const mats = ORDER.map((f) => (f === s.face ? finish(LOOKS[s.mat](), faceSize(f)) : plain));
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
  return { group, level: levelOf(m) };
}
