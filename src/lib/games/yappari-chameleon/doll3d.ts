import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { Atlas } from './atlas';
import { BONES, JOINTS, PARENT, type Bone, type DollSurface } from './doll';
import type { Hit } from './paint';
import { PaintSurface } from './paint-gpu';

export interface DollRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<Bone, THREE.Bone>;
  paint: PaintSurface;
  material: THREE.MeshStandardMaterial;
}

/** 三角形ごとに UV が違うので、頂点を共有せず角ごとに分けた面にする（法線は元の頂点のままなので丸く見える） */
export function makeDoll(renderer: THREE.WebGLRenderer, s: DollSurface, a: Atlas): DollRig {
  const n = a.corner.length;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const v = a.corner[k];
    pos.set(s.pos.subarray(v * 3, v * 3 + 3), k * 3);
    nrm.set(s.nrm.subarray(v * 3, v * 3 + 3), k * 3);
    skinIndex.set(s.skinIndex.subarray(v * 4, v * 4 + 4), k * 4);
    skinWeight.set(s.skinWeight.subarray(v * 4, v * 4 + 4), k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));

  const paintGeo = new THREE.BufferGeometry();
  // three は position の数から描く数を決めるので、UV の位置を position に入れる
  paintGeo.setAttribute('position', new THREE.BufferAttribute(a.paintUv, 2));
  paintGeo.setAttribute('ppos', new THREE.BufferAttribute(a.paintPos, 3));
  paintGeo.setAttribute('pnrm', new THREE.BufferAttribute(nrm, 3));
  const paint = new PaintSurface(renderer, paintGeo);

  const root = new THREE.Group();
  const bones = Object.fromEntries(BONES.map((b) => [b, new THREE.Bone()])) as Record<Bone, THREE.Bone>;
  for (const b of BONES) {
    const p = PARENT[b];
    const at = JOINTS[b];
    bones[b].name = b;
    if (p) {
      const pa = JOINTS[p];
      bones[b].position.set(at[0] - pa[0], at[1] - pa[1], at[2] - pa[2]);
      bones[p].add(bones[b]);
    } else {
      bones[b].position.set(...at);
      root.add(bones[b]);
    }
  }
  root.updateMatrixWorld(true);
  const material = new THREE.MeshStandardMaterial({
    map: paint.color.texture,
    roughnessMap: paint.gloss.texture,
    metalnessMap: paint.gloss.texture,
    roughness: 1,
    metalness: 1
  });
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.bind(new THREE.Skeleton(BONES.map((b) => bones[b])), new THREE.Matrix4());
  // 骨で曲げた形は元の外接球からはみ出すので、画面の端で消えないよう切り捨てない
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return { root, mesh, bones, paint, material };
}

export function restHit(rig: DollRig, hit: THREE.Intersection): Hit | null {
  if (hit.object !== rig.mesh || !hit.face || !hit.barycoord) return null;
  const { a, b, c } = hit.face;
  const w = hit.barycoord;
  const pos = rig.mesh.geometry.attributes.position;
  const nrm = rig.mesh.geometry.attributes.normal;
  const mix = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, j: number) =>
    attr.getComponent(a, j) * w.x + attr.getComponent(b, j) * w.y + attr.getComponent(c, j) * w.z;
  const p: V3 = [mix(pos, 0), mix(pos, 1), mix(pos, 2)];
  const nv = new THREE.Vector3(mix(nrm, 0), mix(nrm, 1), mix(nrm, 2)).normalize();
  return { p, n: [nv.x, nv.y, nv.z] };
}
