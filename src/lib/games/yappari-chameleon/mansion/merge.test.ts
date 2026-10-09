import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeStatic } from './merge';

const mat = (color = '#336699', o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
  m.userData.pick = { tint: [0.2, 0.4, 0.6] };
  return m;
};
const meshes = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
};
const tris = (g: THREE.Object3D) =>
  meshes(g).reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0);

describe('mergeStatic', () => {
  it('同じ見た目の材質の Mesh を 1 つにし、三角形と位置とスポイトの印を残す', () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const o = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat());
      o.position.set(i * 2, 0, 0);
      g.add(o);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1), mat('#ff0000')));
    const before = tris(g);
    mergeStatic(g, () => false);
    const after = meshes(g);
    expect(after).toHaveLength(2);
    expect(tris(g)).toBe(before);
    const box = after.find((m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === '336699')!;
    expect((box.material as THREE.Material).userData.pick).toEqual({ tint: [0.2, 0.4, 0.6] });
    box.geometry.computeBoundingBox();
    expect(box.geometry.boundingBox!.max.x).toBeCloseTo(4.5);
  });

  it('keep の物とその子、影の付け方の違う物はまとめない', () => {
    const g = new THREE.Group();
    const moving = new THREE.Group();
    for (let i = 0; i < 2; i++) moving.add(new THREE.Mesh(new THREE.BoxGeometry(), mat()));
    g.add(moving);
    const cast = new THREE.Mesh(new THREE.BoxGeometry(), mat());
    cast.castShadow = true;
    g.add(cast, new THREE.Mesh(new THREE.BoxGeometry(), mat()));
    mergeStatic(g, (o) => o === moving);
    expect(moving.children).toHaveLength(2);
    expect(meshes(g)).toHaveLength(4);
  });

  it('模様の繰り返しとずらしを uv に焼き、繰り返しの違う面もまとめる', () => {
    const tex = new THREE.Texture({ width: 1, height: 1 });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const g = new THREE.Group();
    const looks: [number, number, number][] = [
      [2, 3, 0.25],
      [5, 1, 0]
    ];
    for (const [rx, ry, off] of looks) {
      const m = mat('#ffffff');
      m.map = tex.clone();
      m.map.repeat.set(rx, ry);
      m.map.offset.set(off, 0);
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(), m));
    }
    mergeStatic(g, () => false);
    const [one] = meshes(g);
    expect(meshes(g)).toHaveLength(1);
    const map = (one.material as THREE.MeshStandardMaterial).map!;
    expect([map.repeat.x, map.repeat.y, map.offset.x, map.offset.y]).toEqual([1, 1, 0, 0]);
    // PlaneGeometry の uv の右上 (1, 1)
    const uv = one.geometry.attributes.uv;
    const corner = (k: number) => [uv.getX(k), uv.getY(k)];
    expect(corner(1)[0]).toBeCloseTo(2.25);
    expect(corner(1)[1]).toBeCloseTo(3);
    expect(corner(5)[0]).toBeCloseTo(5);
  });

  it('面ごとに材質のある箱は、面を材質ごとに分けてまとめる', () => {
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const plain = mat('#3b2414');
      const o = new THREE.Mesh(new THREE.BoxGeometry(), [mat('#00ff00'), plain, plain, plain, plain, plain]);
      o.position.x = i * 3;
      g.add(o);
    }
    mergeStatic(g, () => false);
    const after = meshes(g);
    expect(after).toHaveLength(2);
    expect(after.map((m) => (m.geometry.index!.count / 3) | 0).sort((a, b) => a - b)).toEqual([4, 20]);
  });
});
