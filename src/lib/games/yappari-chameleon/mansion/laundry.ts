import * as THREE from 'three';
import type { Kind } from './layout';
import { box, glowing, type Maker } from './shapes';

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

export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight } satisfies Partial<Record<Kind, Maker>>;
