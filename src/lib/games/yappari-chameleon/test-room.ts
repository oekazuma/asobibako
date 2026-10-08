import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { Box } from './move';
import { checker, damask, finish, oilPainting } from './textures';
import type { Built } from './world3d';

const W = 8;
const D = 8;
const H = 3.2;

function plane(size: [number, number], m: THREE.Material, at: V3, rot: V3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), m);
  mesh.position.set(...at);
  mesh.rotation.set(...rot);
  mesh.receiveShadow = true;
  return mesh;
}

/** 受け入れを試す 1 部屋。奥の壁が緑のダマスクで、金の額の油絵が掛かり、床は白黒の市松 */
export function testRoom(): Built {
  const group = new THREE.Group();
  const green = finish({ pattern: damask('#26330a', '#86a63a') }, [W, H]);
  const plain = finish({ tint: '#d9cdb4' }, [W, H]);
  group.add(plane([W, D], finish({ pattern: checker(), rough: 0.35 }, [W, D]), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane([W, D], finish({ tint: '#efe6d2' }, [W, D]), [0, H, 0], [Math.PI / 2, 0, 0]));
  group.add(plane([W, H], green, [0, H / 2, D / 2], [0, Math.PI, 0]));
  group.add(plane([W, H], plain, [0, H / 2, -D / 2], [0, 0, 0]));
  group.add(plane([D, H], plain, [W / 2, H / 2, 0], [0, -Math.PI / 2, 0]));
  group.add(plane([D, H], plain, [-W / 2, H / 2, 0], [0, Math.PI / 2, 0]));
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.2, 0.06),
    finish({ tint: '#d4af37', metal: 1, rough: 0.35 }, [1.5, 1.2])
  );
  frame.position.set(-1.5, 1.5, D / 2 - 0.03);
  frame.castShadow = true;
  group.add(frame);
  group.add(
    plane(
      [1.2, 0.9],
      finish({ pattern: oilPainting(), rough: 0.6 }, [1.2, 0.9]),
      [-1.5, 1.5, D / 2 - 0.061],
      [0, Math.PI, 0]
    )
  );
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, H, 0.6), finish({ tint: '#f1ece2', rough: 0.5 }, [0.6, H]));
  pillar.position.set(2, H / 2, 1);
  pillar.castShadow = pillar.receiveShadow = true;
  group.add(pillar);
  const t = 0.3;
  const boxes: Box[] = [
    { min: [-W / 2, -1, -D / 2], max: [W / 2, 0, D / 2] },
    { min: [-W / 2, H, -D / 2], max: [W / 2, H + t, D / 2] },
    { min: [-W / 2, 0, D / 2], max: [W / 2, H, D / 2 + t] },
    { min: [-W / 2, 0, -D / 2 - t], max: [W / 2, H, -D / 2] },
    { min: [W / 2, 0, -D / 2], max: [W / 2 + t, H, D / 2] },
    { min: [-W / 2 - t, 0, -D / 2], max: [-W / 2, H, D / 2] },
    { min: [1.7, 0, 0.7], max: [2.3, H, 1.3] }
  ];
  return { group, level: { boxes, ramps: [], spawn: [0, 0, 0] } };
}
