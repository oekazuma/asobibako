import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bear, pine } from './models';

const meshes = (g: THREE.Object3D) => {
  const list: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) list.push(o);
  });
  return list;
};

describe('snow-camp models', () => {
  it('同じ部品は geometry を使い回す', () => {
    const [a, b] = [meshes(pine(0.1)), meshes(pine(0.1))];
    expect(a).toHaveLength(7);
    a.forEach((m, i) => expect(m.geometry).toBe(b[i].geometry));
  });

  it('潰した球は geometry ではなく mesh の scale で潰す', () => {
    const body = meshes(bear())[0];
    expect(body.scale.toArray()).not.toEqual([1, 1, 1]);
    expect(meshes(bear())[0].geometry).toBe(body.geometry);
  });
});
