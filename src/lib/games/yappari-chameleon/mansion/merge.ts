import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ATTRS = ['position', 'normal', 'uv'];
const ids = new WeakMap<object, number>();
let next = 0;
const idOf = (o: object): number => {
  let id = ids.get(o);
  if (id === undefined) ids.set(o, (id = next++));
  return id;
};

interface Part {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
}

/**
 * finish は呼ぶたびに材質を作るので、中身で比べる。屋敷の材質が使う値はこれだけ。
 * 模様の繰り返しとずらしは uv に焼くので鍵に入れず、大きさの違う壁や床もまとめる
 */
const keyOf = ({ mesh, mat }: Part) =>
  [
    mat.color.getHex(),
    mat.emissive.getHex(),
    mat.emissiveIntensity,
    mat.metalness,
    mat.roughness,
    mat.side,
    mat.map ? idOf(mat.map.image as object) : '-',
    !!mat.userData.pick,
    mesh.castShadow,
    mesh.receiveShadow
  ].join('|');

/** 面ごとに材質のある Mesh（壁や床の箱）は面の組ごとに分ける */
function partsOf(mesh: THREE.Mesh): Part[] {
  const mats = mesh.material;
  if (!Array.isArray(mats)) return [{ mesh, geo: mesh.geometry, mat: mats as THREE.MeshStandardMaterial }];
  const index = mesh.geometry.index!;
  return mesh.geometry.groups.map((gr) => {
    const geo = mesh.geometry.clone();
    geo.setIndex(Array.from(index.array.slice(gr.start, gr.start + gr.count)));
    geo.clearGroups();
    return { mesh, geo, mat: mats[gr.materialIndex ?? 0] as THREE.MeshStandardMaterial };
  });
}

const mergeable = (o: THREE.Object3D): o is THREE.Mesh => {
  if (!(o instanceof THREE.Mesh) || o.children.length) return false;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return (
    mats.every((m) => m instanceof THREE.MeshStandardMaterial && !m.transparent) &&
    ATTRS.every((a) => o.geometry.getAttribute(a)) &&
    (!Array.isArray(o.material) || !!o.geometry.index)
  );
};

/**
 * 動かない Mesh を、同じ見た目の材質と影の付け方ごとに 1 つへまとめ、描く回数を減らす（1 枚ごとに影の分も描くので、
 * 家具の部品の数がそのまま重さになる）。keep が true の物とその子は残す
 */
export function mergeStatic(root: THREE.Object3D, keep: (o: THREE.Object3D) => boolean): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const buckets = new Map<string, Part[]>();
  const found: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (mergeable(o)) found.push(o);
  });
  for (const mesh of found) {
    let kept = false;
    for (let p: THREE.Object3D | null = mesh; p && p !== root; p = p.parent) kept ||= keep(p);
    if (kept) continue;
    for (const part of partsOf(mesh)) {
      const k = keyOf(part);
      const b = buckets.get(k);
      if (b) b.push(part);
      else buckets.set(k, [part]);
    }
  }
  // 同じ模様の材質で 1 枚のテクスチャを使い回し、同じ絵を何度も GPU へ送らない
  const maps = new Map<object, THREE.Texture>();
  for (const parts of buckets.values()) {
    const [{ mesh, mat }] = parts;
    if (parts.length < 2 && !Array.isArray(mesh.material)) continue;
    const geos = parts.map(({ mesh, geo, mat }) => {
      const g = new THREE.BufferGeometry();
      for (const a of ATTRS) g.setAttribute(a, geo.getAttribute(a).clone());
      g.setIndex(geo.index ? Array.from(geo.index.array) : [...Array(geo.getAttribute('position').count).keys()]);
      g.applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld));
      if (mat.map) {
        mat.map.updateMatrix();
        (g.getAttribute('uv') as THREE.BufferAttribute).applyMatrix3(mat.map.matrix);
      }
      return g;
    });
    let map: THREE.Texture | null = null;
    if (mat.map) {
      const image = mat.map.image as object;
      map = maps.get(image) ?? mat.map.clone();
      map.offset.set(0, 0);
      map.repeat.set(1, 1);
      map.rotation = 0;
      maps.set(image, map);
    }
    // 属性の型や数がそろわないとまとめられず null が返るので、その組は元の Mesh のまま残す
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    // clone は userData を JSON で写し、スポイトの画素（ImageData）を壊すので、値から作り直す
    const one = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: mat.color,
        emissive: mat.emissive,
        emissiveIntensity: mat.emissiveIntensity,
        metalness: mat.metalness,
        roughness: mat.roughness,
        side: mat.side,
        map
      })
    );
    if (mat.userData.pick) one.material.userData.pick = mat.userData.pick;
    one.castShadow = mesh.castShadow;
    one.receiveShadow = mesh.receiveShadow;
    root.add(one);
    for (const p of parts) p.mesh.removeFromParent();
  }
}
