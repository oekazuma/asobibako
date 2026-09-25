import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '$lib/levels';
import { command, createActor, think, type BehaviorEvent, type WorldView } from './behavior';
import { adopt, newSave, stroke, type Pet } from './engine';
import { LAYOUTS } from './layout';
import { createPet } from './models';
import { ENOUGH, meltAt, strokeWeight, type Part } from './petting';
import type { BreedId } from './types';
import { bodyMarks, partOnRay } from './world3d';

function setup(breed: BreedId, love = 0) {
  const save = newSave(0);
  const pet = adopt(save, breed, 'テスト') as Pet;
  pet.love = love;
  const actor = createActor(pet, { x: 0, z: 0.3 });
  const world: WorldView = {
    scene: 'room',
    layout: LAYOUTS.room,
    bowls: { food: null, foodLeft: 0, waterLeft: 0 },
    toy: null,
    wand: null,
    presents: []
  };
  return { pet, actor, world, rng: new Rng(3).next };
}

/** 画面が毎フレームするのと同じに、part を seconds 秒なで続ける。出た反応を返す */
function rub(s: ReturnType<typeof setup>, part: Part, seconds: number) {
  const events: BehaviorEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    command(s.actor, s.pet, { type: 'stroke', part, amount: 1 / 30 });
    events.push(...think([s.actor], [s.pet], s.world, 1 / 30, s.rng));
  }
  return events.flatMap((e) => (e.type === 'petted' ? [e.feel] : []));
}

function wait(s: ReturnType<typeof setup>, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) think([s.actor], [s.pet], s.world, 1 / 30, s.rng);
}

/** 体の面の頂点のうち、骨が bone で始まり、score がいちばん大きいもの（世界の座標） */
function extreme(group: THREE.Group, bones: string[], score: (v: THREE.Vector3) => number) {
  group.updateMatrixWorld(true);
  const body = group.getObjectsByProperty('isSkinnedMesh', true)[0] as THREE.SkinnedMesh;
  const { skinIndex, skinWeight, position } = body.geometry.attributes;
  let best: THREE.Vector3 | null = null;
  for (let i = 0; i < position.count; i++) {
    const top = [0, 1, 2, 3].reduce((a, k) => (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, a) ? k : a));
    const name = body.skeleton.bones[skinIndex.getComponent(i, top)].name;
    if (!bones.some((b) => name.startsWith(b))) continue;
    const v = body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld);
    if (!best || score(v) > score(best)) best = v;
  }
  return best!;
}

/** 体の面の点 v を、外側 from の向きから指さしたときの場所 */
function touch(group: THREE.Group, v: THREE.Vector3, from: [number, number, number]) {
  const dir = new THREE.Vector3(...from).normalize();
  return partOnRay(bodyMarks(group), new THREE.Ray(v.clone().addScaledVector(dir, 0.5), dir.negate()))?.part;
}

describe('pet-house なでる場所', () => {
  for (const breed of ['shiba', 'mike'] as const)
    it(`${breed}: 体の面の点を外から指さすと、その場所になる`, () => {
      const m = createPet(breed);
      m.update('stand', 1, { speed: 0, wag: 0, look: 0, t: 0 });
      const g = m.group;
      const torso = ['chest', 'hips'];
      const bone = (n: string) => g.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
      const mid = bone('chest').lerp(bone('hips'), 0.5).z;
      // 胴のまん中あたりのいちばん上と下
      const middle = (up: number) => (v: THREE.Vector3) => up * v.y - 3 * Math.abs(v.z - mid);
      expect(touch(g, extreme(g, torso, middle(1)), [0, 1, 0.3])).toBe('back');
      expect(touch(g, extreme(g, torso, middle(-1)), [0.3, -1, 0])).toBe('belly');
      expect(
        touch(
          g,
          extreme(g, ['head', 'ear'], (v) => v.y),
          [0, 1, 0.5]
        )
      ).toBe('head');
      expect(
        touch(
          g,
          extreme(g, ['head', 'jaw'], (v) => v.z - 2 * v.y),
          [0, -0.5, 1]
        )
      ).toBe('chin');
      expect(
        touch(
          g,
          extreme(g, ['head'], (v) => v.x),
          [1, 0, 0.3]
        )
      ).toBe('cheek');
      expect(
        touch(
          g,
          extreme(g, ['tail'], (v) => -v.z + v.y),
          [0, 0.5, -1]
        )
      ).toBe('tail');
      expect(
        touch(
          g,
          extreme(g, ['fl', 'fr'], (v) => -v.y),
          [0, 0.3, 1]
        )
      ).toBe('paw');
      // あお向けにすると、上になったおなかをなでられる
      g.rotation.z = Math.PI;
      expect(touch(g, extreme(g, torso, middle(1)), [0, 1, 0.3])).toBe('belly');
      m.dispose();
    });
});

describe('pet-house なでたときの反応', () => {
  it('犬はなかよしならおなかを見せ、まだならくすぐったがって少し離れる', () => {
    const friend = setup('shiba', 3);
    expect(rub(friend, 'belly', 0.5)).toContain('tickle');
    expect(friend.actor.action).toBe('belly');
    // 転がって指の下が背中になっても、おなかをなで続けたことになる
    rub(friend, 'back', 0.3);
    expect(friend.actor.rub?.part).toBe('belly');
    const stranger = setup('shiba', 0);
    expect(rub(stranger, 'belly', 0.5)).toContain('tickle');
    expect(stranger.actor.mode).toBe('go');
    wait(stranger, 1.5);
    expect(stranger.actor.z).toBeLessThan(0.2);
  });

  it('猫はおなかをなでると前足でパシッとして、なで続けると「もう いいよ」と離れる', () => {
    const s = setup('mike', 4);
    expect(rub(s, 'belly', 0.6)).toEqual(['swat']);
    expect(s.actor.action).toBe('swat');
    expect(rub(s, 'belly', ENOUGH)).toContain('enough');
    const at = { x: s.actor.x, z: s.actor.z };
    rub(s, 'belly', 0.2);
    expect(s.actor.mode).toBe('go');
    wait(s, 2);
    expect(Math.hypot(s.actor.x - at.x, s.actor.z - at.z)).toBeGreaterThan(0.3);
  });

  it('しっぽをなでると、犬は振り返り、猫はしっぽを振っていやがる', () => {
    const dog = setup('beagle', 3);
    expect(rub(dog, 'tail', 0.5)).toEqual(['turn']);
    expect(Math.abs(dog.actor.look)).toBeGreaterThan(0.5);
    const cat = setup('kuro', 3);
    expect(rub(cat, 'tail', 0.5)).toEqual(['flick']);
    expect(cat.actor.wag).toBeGreaterThan(0.8);
    expect(cat.actor.action).toBe('flick');
  });

  it('頭をなでるとうっとりし、やめると座って目を開ける。猫は背中をなでるとお尻を持ち上げる', () => {
    const s = setup('shiba', 2);
    rub(s, 'head', 1);
    expect(s.actor.action).toBe('bliss');
    wait(s, 1);
    expect(s.actor.action).toBe('sit');
    const cat = setup('mike', 2);
    rub(cat, 'back', 0.5);
    expect(cat.actor.action).toBe('arch');
  });

  it('好きな所をなで続けるととろけ、なかよしが増える早さも上がる', () => {
    const s = setup('saba', 1);
    const feels = rub(s, 'chin', meltAt(1) + 0.2);
    expect(feels).toEqual(['like', 'melt']);
    expect(strokeWeight('cat', 1, 'chin', meltAt(1) + 0.2)).toBeGreaterThan(strokeWeight('cat', 1, 'chin', 1));
    expect(strokeWeight('cat', 1, 'belly', 1)).toBe(0);
    const liked = { ...s.pet, love: 0 };
    const disliked = { ...s.pet, love: 0 };
    stroke(liked, 1, strokeWeight('cat', 0, 'chin', 1));
    stroke(disliked, 1, strokeWeight('cat', 0, 'tail', 1));
    expect(liked.love).toBeGreaterThan(0);
    expect(disliked.love).toBe(0);
  });

  it('前足をなでると、おての形をする', () => {
    const s = setup('poodle', 2);
    rub(s, 'paw', 0.5);
    expect(s.actor.action).toBe('paw');
  });
});
