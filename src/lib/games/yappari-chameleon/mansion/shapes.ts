import * as THREE from 'three';
import { finish, type Finish } from '../textures';
import type { Piece } from './layout';

export type Maker = (g: THREE.Group, p: Piece) => void;

export const BLACK: Finish = { tint: '#141414', rough: 0.15 };
export const GOLD: Finish = { tint: '#d4af37', metal: 1, rough: 0.3 };
export const WHITE: Finish = { tint: '#f1ece2', rough: 0.5 };
export const WOOD: Finish = { tint: '#4a2e1a', rough: 0.55 };

export function box(
  g: THREE.Group,
  size: [number, number, number],
  f: Finish,
  at: [number, number, number],
  face: [number, number] = [size[0], size[1]]
) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), finish(f, face));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

export function cyl(g: THREE.Group, r: [number, number], h: number, f: Finish, at: [number, number, number], seg = 24) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r[0], r[1], h, seg), finish(f, [Math.PI * 2 * r[0], h]));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

export function ball(g: THREE.Group, r: number, f: Finish, at: [number, number, number]) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), finish(f, [r * 3, r * 3]));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

export function plane(g: THREE.Group, size: [number, number], f: Finish, at: [number, number, number], rotX = 0) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(...size), finish(f, size));
  o.position.set(...at);
  o.rotation.x = rotX;
  o.receiveShadow = true;
  g.add(o);
  return o;
}

export const variant = (p: Piece) => Math.abs(Math.round(p.at[0] * 7 + p.at[2] * 13));
