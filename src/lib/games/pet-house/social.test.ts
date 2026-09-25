import { describe, expect, it } from 'vitest';
import { Rng } from '$lib/levels';
import { command, createActor, think, throwToy, type Actor, type BehaviorEvent, type WorldView } from './behavior';
import { NATURAL_ROOM } from './decor';
import { adopt, newSave, type Pet } from './engine';
import { LAYOUTS, ROOM, roomPerches, type Spot } from './layout';
import { bodyOf, capOf, gap, SNUG } from './social';
import type { BaseScene, BreedId } from './types';

function setup(breeds: BreedId[], at: Spot[], scene: BaseScene = 'room', seed = 3) {
  const save = newSave(0);
  save.money = 10000;
  const pets = breeds.map((b) => adopt(save, b, 'テスト') as Pet);
  for (const p of pets) p.stats = { food: 100, water: 100, clean: 100, energy: 100 };
  const actors = pets.map((p, i) => createActor(p, at[i]));
  const world: WorldView = {
    scene,
    layout: LAYOUTS[scene],
    bowls: { food: null, foodLeft: 0, waterLeft: 0 },
    toy: null,
    wand: null,
    presents: [],
    perches: scene === 'room' ? roomPerches(NATURAL_ROOM) : undefined
  };
  return { pets, actors, world, rng: new Rng(seed).next };
}
type Setup = ReturnType<typeof setup>;

function run(s: Setup, seconds: number, each?: () => void) {
  const events: BehaviorEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    each?.();
    events.push(...think(s.actors, s.pets, s.world, 1 / 30, s.rng));
  }
  return events;
}

const socials = (e: BehaviorEvent[]) => e.filter((x) => x.type === 'social');
/** 起きている子どうしがめり込んでいる深さのいちばん大きいもの */
const worst = (actors: Actor[]) => {
  let w = 0;
  for (const a of actors)
    for (const o of actors)
      if (a !== o && !a.hop && !o.hop && Math.abs(a.y - o.y) < 0.2) w = Math.min(w, gap(capOf(a), capOf(o)).d);
  return w;
};

describe('pet-house なかま', () => {
  it('体の大きさは種類で違う。ダックスは長く、チワワは小さい', () => {
    const len = (b: BreedId) => bodyOf(b).fore + bodyOf(b).aft;
    expect(len('dachshund')).toBeGreaterThan(len('labrador'));
    expect(len('chihuahua')).toBeLessThan(len('shiba') * 0.8);
    expect(bodyOf('chihuahua').w).toBeLessThan(bodyOf('labrador').w);
  });

  it('ひまな 2 匹は、10〜30 秒に 1 回ほど、あいさつ・じゃれ合い・毛づくろいをする', () => {
    for (const breeds of [
      ['shiba', 'beagle'],
      ['labrador', 'mike'],
      ['mike', 'fold']
    ] as BreedId[][]) {
      const s = setup(breeds, [
        { x: -0.6, z: -0.2 },
        { x: 0.6, z: -0.6 }
      ]);
      const starts = socials(run(s, 180)).filter(
        (e) => e.kind === 'greet' || e.kind === 'invite' || e.kind === 'groom'
      );
      expect(starts.length, breeds.join('+')).toBeGreaterThanOrEqual(5);
      expect(starts.length, breeds.join('+')).toBeLessThanOrEqual(18);
    }
  });

  it('じゃれ合いでも毛づくろいでも、なかよし（love）は変えない', () => {
    const s = setup(
      ['corgi', 'chatora'],
      [
        { x: -0.5, z: 0 },
        { x: 0.5, z: -0.4 }
      ]
    );
    const love = s.pets.map((p) => p.love);
    run(s, 120);
    expect(s.pets.map((p) => p.love)).toEqual(love);
  });

  it('プレイヤーがなでている子・芸をしている子・おもちゃを追う子は、ほかの子に誘われない', () => {
    const s = setup(
      ['labrador', 'beagle'],
      [
        { x: -0.4, z: 0.2 },
        { x: 0.4, z: -0.3 }
      ]
    );
    const [me] = s.actors;
    let i = 0;
    const events = run(s, 90, () => {
      i++;
      // なでる・芸を交互に、ずっと構い続ける
      if (i % 90 < 60) command(me, s.pets[0], { type: 'stroke', part: 'back', amount: 1 / 30 });
      else if (i % 90 === 60) command(me, s.pets[0], { type: 'trick', trick: 'sit', success: true });
    });
    expect(socials(events).filter((e) => e.petId === me.petId || e.with === me.petId)).toEqual([]);
  });

  it('ボールを 2 匹で追うと、咥えた子のあとを別の子が追いかけ、最後は咥えた子が持ってくる', () => {
    let rivals = 0;
    let fetched = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = setup(['shiba', 'beagle'], [ROOM.front, { x: 0.5, z: 0.6 }], 'room', seed);
      for (const a of s.actors) a.palAt = 999;
      s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.9 }, { x: 0.3, y: 1.5, z: -2.4 });
      const events = run(s, 25, () => {
        for (const a of s.actors) a.tease = false;
      });
      if (socials(events).some((e) => e.kind === 'rival')) rivals++;
      if (events.some((e) => e.type === 'fetched')) fetched++;
    }
    expect(rivals).toBeGreaterThanOrEqual(2);
    expect(fetched).toBe(6);
  });

  it('ダックスとラブラドールは、重なった所から押しのけ合って体が重ならない', () => {
    const s = setup(
      ['dachshund', 'labrador'],
      [
        { x: 0, z: 0 },
        { x: 0.05, z: 0.1 }
      ]
    );
    for (const a of s.actors) a.palAt = 999;
    // 前後に並んで同じ向き（鼻先がお尻に入りこむ形）
    s.actors[1].heading = s.actors[0].heading = 0;
    run(s, 1.5);
    expect(worst(s.actors)).toBeGreaterThan(-0.02);
    // 何分歩きまわっても、めり込んだままにならない
    let deep = 0;
    run(s, 120, () => (deep = Math.min(deep, worst(s.actors))));
    expect(deep).toBeGreaterThan(-0.06);
  });

  it('お皿には足を入れない。食べるのは 1 匹ずつで、ほかの子はそばで順番を待つ', () => {
    const s = setup(
      ['dachshund', 'labrador', 'corgi'],
      [
        { x: -0.5, z: 0.3 },
        { x: 0.2, z: 0.5 },
        { x: 0.6, z: -0.2 }
      ]
    );
    for (const p of s.pets) p.stats.food = 20;
    s.world.bowls = { food: 'dogfood', foodLeft: 1, waterLeft: 1 };
    const bowls = [ROOM.food, ROOM.water].map((k) => ({ seg: [k.x, k.z, k.x, k.z] as const, r: 0.122 }));
    let deep = 0;
    let eaters = 0;
    let waited = 0;
    run(s, 12, () => {
      // お皿へ向かう子・食べている子・食べ終えたばかりの子のほかは、お皿にめり込まない
      for (const a of s.actors) {
        if (a.goal === 'food') continue;
        for (const b of bowls) deep = Math.min(deep, gap(capOf(a), b).d);
      }
      eaters = Math.max(eaters, s.actors.filter((a) => a.mode === 'eat').length);
      if (
        s.actors.some((a) => a.mode === 'eat') &&
        s.actors.some((a) => a.mode !== 'eat' && Math.hypot(a.x - ROOM.food.x, a.z - ROOM.food.z) < 1.2)
      )
        waited++;
    });
    expect(deep).toBeGreaterThan(-0.03);
    expect(eaters).toBe(1);
    expect(waited).toBeGreaterThan(30);
  });

  it('眠いとき、寝ている子のとなりに体を寄せて寝る。寝ころんだ体は重ならない', () => {
    for (const breeds of [
      ['shiba', 'corgi'],
      ['labrador', 'mike'],
      ['mike', 'saba'],
      ['dachshund', 'chihuahua']
    ] as BreedId[][]) {
      let snug = 0;
      for (let seed = 1; seed <= 4; seed++) {
        const s = setup(
          breeds,
          [
            { x: -0.3, z: -0.2 },
            { x: 0.8, z: 0.4 }
          ],
          'park',
          seed
        );
        const [a, b] = s.actors;
        s.pets[0].stats.energy = 5;
        run(s, 3);
        expect(a.asleep).toBe(true);
        s.pets[1].stats.energy = 5;
        const events = run(s, 15);
        expect(b.asleep).toBe(true);
        if (socials(events).some((e) => e.kind === 'snuggle')) {
          snug++;
          // となりに寄っている
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.6);
        }
        expect(gap(capOf(a), capOf(b)).d, breeds.join('+')).toBeGreaterThan(-SNUG - 0.02);
      }
      expect(snug, breeds.join('+')).toBeGreaterThanOrEqual(1);
    }
  });

  it('同じころに眠くなった子は、先に寝に行った子について行って、となりで寝ることがある', () => {
    let snug = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = setup(
        ['beagle', 'fold'],
        [
          { x: -0.3, z: 0.2 },
          { x: 0.5, z: 0.4 }
        ],
        'room',
        seed
      );
      for (const p of s.pets) p.stats.energy = 5;
      const events = run(s, 30);
      expect(s.actors.every((a) => a.asleep)).toBe(true);
      if (socials(events).some((e) => e.kind === 'snuggle')) snug++;
      const [a, b] = s.actors;
      if (Math.abs(a.y - b.y) < 0.2) expect(gap(capOf(a), capOf(b)).d).toBeGreaterThan(-SNUG - 0.02);
    }
    expect(snug).toBeGreaterThanOrEqual(2);
  });

  it('ソファで寝ている子のとなりに寝に来ても、重ならない', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = setup(
        ['mike', 'labrador', 'kuro'],
        [
          { x: 0, z: -1.2 },
          { x: 0.8, z: 0.2 },
          { x: -0.8, z: 0.3 }
        ],
        'room',
        seed
      );
      const sofa = s.world.perches![0];
      const [a] = s.actors;
      [a.perch, a.x, a.z, a.y] = ['sofa', sofa.x, sofa.z, sofa.y];
      s.pets[0].stats.energy = 5;
      run(s, 3);
      expect(a.asleep).toBe(true);
      s.pets[1].stats.energy = 5;
      s.pets[2].stats.energy = 5;
      run(s, 25);
      const sleepers = s.actors.filter((x) => x.asleep);
      expect(sleepers.length).toBe(3);
      for (const x of sleepers)
        for (const y of sleepers)
          if (x !== y && Math.abs(x.y - y.y) < 0.2) expect(gap(capOf(x), capOf(y)).d).toBeGreaterThan(-SNUG - 0.02);
    }
  });
});
