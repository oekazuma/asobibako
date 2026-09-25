import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BREED_IDS, BREEDS } from './breeds';
import { LOOKS } from './looks';
import { FOAM_SPOTS, createPet } from './models';
import { field } from './sculpt';
import type { Quality } from '$lib/graphics.svelte';
import type { AccessoryId, BreedId, PetAction } from './types';

const ACTIONS: PetAction[] = [
  'stand',
  'walk',
  'run',
  'sit',
  'down',
  'sleep',
  'eat',
  'paw',
  'roll',
  'jump',
  'pounce',
  'happy',
  'shake'
];
const ACCESSORIES: AccessoryId[] = ['collar-red', 'collar-blue', 'ribbon', 'hat', 'bandana'];
const o = { speed: 0.7, wag: 1, look: 0.5, t: 0 };
const QUALITIES: Quality[] = ['high', 'normal', 'low'];

/** 骨で曲げたあとの体の面の箱。tail が false ならしっぽの頂点を除く */
function bodyBox(group: THREE.Group, tail = true) {
  group.updateMatrixWorld(true);
  const body = group.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const w = body.geometry.attributes.skinWeight;
  const idx = body.geometry.attributes.skinIndex;
  for (let i = 0; i < body.geometry.attributes.position.count; i++) {
    const top = [0, 1, 2, 3].reduce((a, k) => (w.getComponent(i, k) > w.getComponent(i, a) ? k : a), 0);
    if (!tail && body.skeleton.bones[idx.getComponent(i, top)].name.startsWith('tail')) continue;
    box.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld));
  }
  return box;
}

const hips = (id: BreedId) => {
  const pet = createPet(id);
  return { pet, y: () => pet.group.getObjectByName('hips')!.position.y };
};

describe('pet-house models', () => {
  it.each(BREED_IDS)('%s は立った姿の背の高さ（耳の先まで、しっぽは除く）が実物に近く、足が床に着く', (id) => {
    const pet = createPet(id);
    pet.update('stand', 1 / 60, o);
    const box = bodyBox(pet.group, false);
    const [lo, hi] = BREEDS[id].kind === 'dog' ? [0.33, 0.48] : [0.26, 0.33];
    expect(box.max.y).toBeGreaterThanOrEqual(lo);
    expect(box.max.y).toBeLessThanOrEqual(hi);
    expect(box.min.y).toBeGreaterThan(-0.01);
    expect(box.min.y).toBeLessThan(0.01);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 2);
  });

  it.each(BREED_IDS)('%s はどの action を続けても行列に NaN が出ず、体が床に沈まない', (id) => {
    const pet = createPet(id);
    for (const action of ACTIONS) {
      for (let f = 0; f < 150; f++) {
        pet.update(action, f === 40 ? 0.5 : 1 / 60, o);
        pet.group.updateMatrixWorld(true);
        pet.group.traverse((obj) => {
          if (!obj.matrixWorld.elements.every(Number.isFinite)) throw new Error(`${action} ${obj.type}`);
        });
      }
      if (action !== 'roll') expect(bodyBox(pet.group, false).min.y, action).toBeGreaterThan(-0.02);
    }
  });

  it('おすわりでは腰が床近くまで下がり、前足はのびたまま床に着く', () => {
    const pet = createPet('shiba');
    for (let f = 0; f < 120; f++) pet.update('sit', 1 / 60, o);
    pet.group.updateMatrixWorld(true);
    const hipsAt = pet.group.getObjectByName('hips')!.getWorldPosition(new THREE.Vector3());
    const paw = pet.group.getObjectByName('fl.3')!.getWorldPosition(new THREE.Vector3());
    expect(hipsAt.y).toBeLessThan(0.1);
    expect(paw.y).toBeLessThan(0.025);
  });

  it('action を変えても 1 フレームでは目標のかっこうへ飛ばない', () => {
    const { pet, y } = hips('beagle');
    for (let f = 0; f < 60; f++) pet.update('stand', 1 / 60, o);
    const stand = y();
    for (let f = 0; f < 90; f++) pet.update('sit', 1 / 60, o);
    const sit = y();
    for (let f = 0; f < 60; f++) pet.update('stand', 1 / 60, o);
    pet.update('sit', 1 / 60, o);
    expect(Math.abs(y() - stand)).toBeLessThan(Math.abs(sit - stand) * 0.3);
    expect(Math.abs(sit - stand)).toBeGreaterThan(0.1);
  });

  it('アクセサリーは 1 つだけ見え、null で外れる', () => {
    const pet = createPet('kuro');
    const shown = () => pet.group.children[0].getObjectsByProperty('name', 'accessory').filter((a) => a.visible);
    expect(shown()).toHaveLength(0);
    for (const id of ACCESSORIES) {
      pet.setAccessory(id);
      expect(shown().map((a) => a.userData.id)).toEqual([id]);
    }
    pet.setAccessory(null);
    expect(shown()).toHaveLength(0);
  });

  it.each(BREED_IDS)('%s のアクセサリーは描く物が 1〜3 個で形がこわれず、首に巻く物は体と同じ骨で曲がる', (id) => {
    const pet = createPet(id);
    const body = pet.group.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh;
    for (const acc of ACCESSORIES) {
      pet.setAccessory(acc);
      const meshes = pet.group.getObjectsByProperty('name', 'accessory').find((a) => a.visible)!
        .children as THREE.Mesh[];
      expect(meshes.length, acc).toBeGreaterThanOrEqual(1);
      expect(meshes.length, acc).toBeLessThanOrEqual(3);
      for (const m of meshes) {
        expect((m.geometry.attributes.position.array as Float32Array).every(Number.isFinite), acc).toBe(true);
        if (acc !== 'hat') expect((m as THREE.SkinnedMesh).skeleton, acc).toBe(body.skeleton);
      }
    }
  });

  it.each(BREED_IDS)('%s のぼうしは耳に刺さらない', (id) => {
    const pet = createPet(id);
    pet.setAccessory('hat');
    const ears = field(LOOKS[id].shapes.filter((s) => s.tag === 'ear'));
    const hat = pet.group.getObjectsByProperty('name', 'accessory').find((a) => a.visible)!;
    for (const m of hat.children as THREE.Mesh[]) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) expect(ears(pos.getX(i), pos.getY(i), pos.getZ(i))).toBeGreaterThan(0);
    }
  });

  it('mouth は頭の前にあり、首を下げると一緒に下がる。咥えたおもちゃは m の大きさのまま', () => {
    const pet = createPet('shiba');
    const at = () => {
      pet.group.updateMatrixWorld(true);
      return pet.mouth.getWorldPosition(new THREE.Vector3());
    };
    const stand = at();
    expect(stand.z).toBeGreaterThan(0.15);
    expect(pet.mouth.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(1, 5);
    for (let f = 0; f < 60; f++) pet.update('eat', 1 / 60, o);
    expect(at().y).toBeLessThan(stand.y - 0.08);
    expect(at().y).toBeLessThan(0.12);
  });

  it.each(BREED_IDS.flatMap((id) => QUALITIES.map((q) => [id, q] as const)))(
    '%s（%s）は汚れてバンダナを着けても、1 匹の描く物（mesh と線）が画質ごとの上限以下（normal で 30）',
    (id, q) => {
      const pet = createPet(id, q);
      pet.setAccessory('bandana');
      pet.setDirt(1);
      pet.update('happy', 1 / 60, o);
      let n = 0;
      pet.group.traverseVisible((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) n++;
      });
      expect(n).toBeLessThanOrEqual({ high: 40, normal: 30, low: 24 }[q]);
    }
  );

  it('画質が上がるほど殻が多く、low は殻を 2 枚まで減らす', () => {
    const shells = (q: Quality) => createPet('shiba', q).group.getObjectsByProperty('isSkinnedMesh', true).length - 1;
    expect(shells('high')).toBeGreaterThan(shells('normal'));
    expect(shells('normal')).toBeGreaterThan(shells('low'));
    expect(shells('low')).toBe(2);
  });

  it('setQuality は形を入れ替えても、かっこう・アクセサリー・汚れ・咥えたおもちゃを引き継ぐ', () => {
    const pet = createPet('mike');
    pet.setAccessory('ribbon');
    pet.setDirt(1);
    for (let f = 0; f < 90; f++) pet.update('sit', 1 / 60, o);
    const toy = new THREE.Object3D();
    pet.mouth.add(toy);
    const hipsY = pet.group.getObjectByName('hips')!.position.y;
    const before = pet.group.getObjectsByProperty('isSkinnedMesh', true).length;
    pet.setQuality('low');
    expect(pet.group.children).toHaveLength(1);
    expect(pet.group.getObjectsByProperty('isSkinnedMesh', true).length).toBeLessThan(before);
    expect(pet.group.getObjectByName('hips')!.position.y).toBeCloseTo(hipsY, 5);
    const shown = pet.group.getObjectsByProperty('name', 'accessory').filter((a) => a.visible);
    expect(shown.map((a) => a.userData.id)).toEqual(['ribbon']);
    const skin = (g: THREE.Object3D) =>
      (g.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh).material;
    expect(skin(pet.group)).not.toBe(skin(createPet('mike', 'low').group));
    expect(toy.parent).toBe(pet.mouth);
    pet.update('sit', 1 / 60, o);
  });

  it('ぬれた子だけ毛の material がつやのある別のものになり、乾くと元の共有の material に戻る', () => {
    const roughness = (g: THREE.Object3D) =>
      (g.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[]).map(
        (m) => (m.material as THREE.MeshStandardMaterial).roughness
      );
    const [a, b] = [createPet('shiba'), createPet('shiba')];
    const dry = roughness(a.group);
    a.setWet(1);
    expect(roughness(a.group).every((r, i) => r < dry[i])).toBe(true);
    expect(roughness(b.group)).toEqual(dry);
    a.setWet(0);
    const meshes = (g: THREE.Object3D) => g.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
    meshes(a.group).forEach((m, i) => expect(m.material).toBe(meshes(b.group)[i].material));
  });

  it('汚れた子だけ毛の material が別のものになり、きれいになると共有の material に戻る', () => {
    const skin = (g: THREE.Object3D) =>
      (g.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh).material;
    const [a, b] = [createPet('beagle'), createPet('beagle')];
    a.setDirt(0.8);
    expect(skin(a.group)).not.toBe(skin(b.group));
    a.setDirt(0);
    expect(skin(a.group)).toBe(skin(b.group));
  });

  it.each(BREED_IDS)('%s は目を閉じると目の線が 2 本出て、開くと消える', (id) => {
    const pet = createPet(id);
    const shown = () => pet.group.getObjectsByProperty('name', 'lash').filter((l) => l.visible).length;
    for (let f = 0; f < 60; f++) pet.update('stand', 1 / 60, o);
    expect(shown()).toBe(0);
    for (let f = 0; f < 60; f++) pet.update('sleep', 1 / 60, o);
    expect(shown()).toBe(2);
  });

  it('いちばん汚れた段だけノミが跳ね、泡を付けると消える', () => {
    const pet = createPet('shiba');
    const fleas = () => pet.group.getObjectByName('fleas') as THREE.InstancedMesh;
    const run = () => {
      for (let f = 0; f < 120; f++) pet.update('stand', 1 / 60, o);
      return fleas().visible;
    };
    pet.setDirt(0.66);
    expect(run()).toBe(false);
    pet.setDirt(1);
    const heights = new Set<number>();
    const m = new THREE.Matrix4();
    for (let f = 0; f < 90; f++) {
      pet.update('stand', 1 / 60, o);
      fleas().getMatrixAt(0, m);
      heights.add(Math.round(m.elements[13] * 100));
    }
    expect(fleas().visible).toBe(true);
    expect(heights.size).toBeGreaterThan(3);
    pet.setFoam(new Array(FOAM_SPOTS).fill(1));
    expect(run()).toBe(false);
    pet.setFoam([]);
    pet.setDirt(0);
    pet.setDirt(1);
    expect(run()).toBe(true);
  });

  it.each(QUALITIES)('%s でも泡は量に合わせて見え、体の上にあり、ぬれと泡は画質を変えても残る', (q) => {
    const pet = createPet('mike', q);
    const shown = () => pet.group.getObjectsByProperty('name', 'foam').filter((m) => m.visible).length;
    expect(shown()).toBe(0);
    const levels = new Array(FOAM_SPOTS).fill(0);
    levels[0] = 1;
    pet.setFoam(levels);
    expect(shown()).toBe(1);
    pet.setFoam(new Array(FOAM_SPOTS).fill(1));
    pet.setWet(1);
    for (let f = 0; f < 60; f++) pet.update('shake', 1 / 60, o);
    pet.group.updateMatrixWorld(true);
    const back = pet.foamAt(0, new THREE.Vector3());
    expect(back.y).toBeGreaterThan(0.15);
    expect(back.y).toBeLessThan(0.35);
    pet.setQuality(q === 'low' ? 'high' : 'low');
    expect(shown()).toBeGreaterThanOrEqual(4);
    const skin = pet.group.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh;
    expect((skin.material as THREE.MeshStandardMaterial).roughness).toBeLessThan(0.6);
    pet.setFoam([]);
    expect(shown()).toBe(0);
  });

  it('ぶるぶるでは胴が左右にねじれる', () => {
    const pet = createPet('beagle');
    const twist: number[] = [];
    for (let f = 0; f < 90; f++) {
      pet.update('shake', 1 / 60, o);
      twist.push(pet.group.getObjectByName('chest')!.rotation.z);
    }
    expect(Math.max(...twist.slice(30))).toBeGreaterThan(0.2);
    expect(Math.min(...twist.slice(30))).toBeLessThan(-0.2);
  });

  it('同じ種類の 2 匹目は geometry と material を使い回す', () => {
    const meshes = (g: THREE.Object3D) => g.getObjectsByProperty('isMesh', true) as THREE.Mesh[];
    const [a, b] = [meshes(createPet('poodle').group), meshes(createPet('poodle').group)];
    expect(a.length).toBe(b.length);
    a.forEach((m, i) => {
      expect(m.geometry).toBe(b[i].geometry);
      expect(m.material).toBe(b[i].material);
    });
  });
});
