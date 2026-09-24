import * as THREE from 'three';
import type { Built } from './activity';
import { PARK, type Layout } from './layout';
import { box, cyl, geo, mat, mesh } from './props';
import { buildPark, rounded } from './scenes';

/**
 * ふれあいひろば。公園の芝と遠景をそのまま使い、白い木の柵で囲んで、小屋と水飲み場を置く。
 * 公園の木と植え込みはそのまま残すので、ペットが通れない丸にも入れておく
 */

const KENNEL = { x: 0.5, z: -4.95, r: 0.55 };
const TROUGH = { x: -1.5, z: -1.7, r: 0.35 };
const FENCE = { x: 2.6, back: -6, front: 2.5, step: 1.1 };

export function plazaLayout(): Layout {
  return {
    bounds: { x0: -1.9, x1: 1.9, z0: -5.3, z1: 0.9 },
    front: { x: 0, z: -2.2 },
    blocks: [...PARK.blocks, KENNEL, TROUGH],
    camera: { x: 0, y: 2.5, z: 2.9, lookX: 0, lookY: 0, lookZ: -2.3, fov: 50 }
  };
}

export function buildPlaza(): Built {
  const park = buildPark();
  const g = park.group;
  g.add(fence(), kennel(), trough());
  return park;
}

function fence() {
  const g = new THREE.Group();
  const white = mat('#f2efe6', { roughness: 0.8 });
  const post = rounded(0.09, 0.8, 0.09, 0.015);
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / FENCE.step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      g.add(mesh(post, white, x0 + (x1 - x0) * t, 0.4, z0 + (z1 - z0) * t));
    }
    const rail = geo(`rail:${len.toFixed(2)}`, () => new THREE.BoxGeometry(len, 0.07, 0.035));
    for (const y of [0.32, 0.62]) {
      const r = mesh(rail, white, (x0 + x1) / 2, y, (z0 + z1) / 2);
      r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      g.add(r);
    }
  };
  const { x, back, front } = FENCE;
  side(-x, back, x, back);
  side(-x, front, x, front);
  side(-x, back, -x, front);
  side(x, back, x, front);
  return g;
}

/** 三角屋根の木の犬小屋。入口の暗い穴をこちらへ向ける */
function kennel() {
  const g = new THREE.Group();
  const wood = mat('#b98652', { roughness: 0.85 });
  const [w, h, d] = [0.9, 0.6, 0.8];
  g.add(mesh(box(w, h, d), wood, 0, h / 2, 0));
  const roof = geo('kennel-roof', () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.1, 0);
    s.lineTo(w / 2 + 0.1, 0);
    s.lineTo(0, 0.42);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d + 0.14, bevelEnabled: false }).translate(0, 0, -(d + 0.14) / 2);
  });
  g.add(mesh(roof, mat('#a4473b', { roughness: 0.8 }), 0, h, 0));
  const door = geo('kennel-door', () => new THREE.CircleGeometry(0.2, 24, 0, Math.PI).translate(0, 0.2, 0));
  g.add(mesh(box(0.4, 0.2, 0.01), '#2a1d14', 0, 0.1, d / 2 + 0.003, false), mesh(door, '#2a1d14', 0, 0, d / 2 + 0.004));
  g.position.set(KENNEL.x, 0, KENNEL.z);
  g.rotation.y = -0.25;
  return g;
}

/** 石の水飲み場。浅い水盤と、細い蛇口の柱 */
function trough() {
  const g = new THREE.Group();
  const stone = mat('#b9b4aa', { roughness: 0.95 });
  g.add(mesh(rounded(0.62, 0.22, 0.42, 0.05), stone, 0, 0.11, 0));
  const water = new THREE.MeshPhysicalMaterial({ color: '#9cc8d8', roughness: 0.05, clearcoat: 1 });
  g.add(mesh(box(0.5, 0.01, 0.3), water, 0, 0.215, 0, false));
  g.add(mesh(cyl(0.035, 0.04, 0.7, 12), stone, 0.24, 0.35, -0.16));
  g.add(mesh(cyl(0.012, 0.012, 0.14, 8), mat('#9aa0a6', { metalness: 0.8, roughness: 0.3 }), 0.24, 0.64, -0.1));
  g.position.set(TROUGH.x, 0, TROUGH.z);
  g.rotation.y = 0.4;
  return g;
}
