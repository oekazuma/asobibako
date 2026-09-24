import { describe, expect, it } from 'vitest';
import { Rng } from '$lib/levels';
import { command, createActor, think, throwToy, type Actor, type BehaviorEvent, type WorldView } from './behavior';
import { adopt, newSave, type Pet } from './engine';
import { LAYOUTS, PARK, ROOM, type Spot } from './layout';
import type { BaseScene, BreedId } from './types';

function setup(breeds: BreedId[], scene: BaseScene = 'room', at: Spot[] = [{ x: -0.6, z: 0.5 }]) {
  const save = newSave(0);
  save.money = 10000;
  const pets = breeds.map((b) => adopt(save, b, 'テスト') as Pet);
  const actors = pets.map((p, i) => createActor(p, at[i] ?? { x: i * 0.5 - 0.5, z: 0 }));
  const world: WorldView = {
    scene,
    layout: LAYOUTS[scene],
    bowls: { food: null, foodLeft: 0, waterLeft: 0 },
    toy: null,
    wand: null,
    presents: []
  };
  return { pets, actors, world, rng: new Rng(7).next };
}

type Setup = ReturnType<typeof setup>;

/** until が true を返すか seconds 経つまで回し、出たイベントを返す */
function run(s: Setup, seconds: number, until?: (e: BehaviorEvent[]) => boolean, each?: (t: number) => void) {
  const events: BehaviorEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    each?.(t);
    events.push(...think(s.actors, s.pets, s.world, 1 / 30, s.rng));
    if (until?.(events)) break;
  }
  return events;
}

const has = (type: BehaviorEvent['type']) => (e: BehaviorEvent[]) => e.some((x) => x.type === type);

describe('pet-house behavior', () => {
  it('おなかがすいていると、お皿へ行って食べ、食べきると ate', () => {
    const s = setup(['shiba']);
    s.pets[0].stats.food = 20;
    s.world.bowls = { food: 'dogfood', foodLeft: 1, waterLeft: 0 };
    const events = run(s, 25, has('ate'));
    expect(events).toContainEqual({ type: 'ate', petId: s.pets[0].id, food: 'dogfood' });
    expect(s.world.bowls.foodLeft).toBe(0);
    expect(Math.hypot(s.actors[0].x - ROOM.food.x, s.actors[0].z - ROOM.food.z)).toBeLessThan(0.4);
  });

  it('投げたボールを犬が取りに行き、front まで持ってきて fetched', () => {
    const s = setup(['beagle'], 'room', [ROOM.front]);
    s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.9 }, { x: 0.4, y: 1.5, z: -2.6 });
    const events = run(s, 25, has('fetched'));
    expect(events).toContainEqual({ type: 'fetched', petId: s.pets[0].id });
    const toy = s.world.toy!;
    expect(toy.holder).toBeNull();
    expect(Math.hypot(toy.x - ROOM.front.x, toy.z - ROOM.front.z)).toBeLessThan(0.4);
    expect(s.actors[0].carrying).toBeNull();
  });

  it('フリスビーはボールよりゆっくり落ちて遠くまで飛ぶ', () => {
    const flight = (kind: 'ball' | 'frisbee') => {
      const s = setup([], 'park');
      const toy = throwToy(kind, { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -3.5 });
      s.world.toy = toy;
      let t = 0;
      while (toy.y > 0.1 && t < 5) {
        think([], [], s.world, 1 / 60, s.rng);
        t += 1 / 60;
      }
      return { t, far: 1 - toy.z };
    };
    const ball = flight('ball');
    const frisbee = flight('frisbee');
    expect(frisbee.t).toBeGreaterThan(ball.t * 1.5);
    expect(frisbee.far).toBeGreaterThan(ball.far * 1.5);
  });

  it('投げたおもちゃは弾んで転がり、範囲の中で止まる', () => {
    const s = setup([], 'room');
    const toy = throwToy('ball', { x: 0, y: 1, z: 0.8 }, { x: 3, y: 2, z: -6 });
    s.world.toy = toy;
    run(s, 15, () => toy.still);
    expect(toy.still).toBe(true);
    const b = ROOM.bounds;
    expect(toy.x).toBeGreaterThanOrEqual(b.x0);
    expect(toy.x).toBeLessThanOrEqual(b.x1);
    expect(toy.z).toBeGreaterThanOrEqual(b.z0);
    expect(toy.z).toBeLessThanOrEqual(b.z1);
  });

  it('猫は振っているねこじゃらしに近づき、飛びついて caught', () => {
    const s = setup(['mike'], 'room', [{ x: -0.8, z: -1 }]);
    const actions = new Set<string>();
    const events = run(s, 15, has('caught'), (t) => {
      s.world.wand = { x: 0.5 + Math.sin(t * 2) * 0.15, z: 0.3, moving: true };
      actions.add(s.actors[0].action);
    });
    expect(events).toContainEqual({ type: 'caught', petId: s.pets[0].id });
    expect(actions).toContain('pounce');
  });

  for (const [how, v] of [
    ['転がした', { x: 0.2, y: 0, z: -1.6 }],
    ['床に置いた', { x: 0, y: 0, z: 0 }]
  ] as const) {
    it(`${how}ねずみを猫が追い、身をかがめて前足でちょいちょいしてから飛びつく`, () => {
      const s = setup(['mike'], 'room', [{ x: -0.9, z: -1.2 }]);
      s.world.toy = throwToy('mouse', { x: 0.3, y: 0.03, z: 0.6 }, v);
      const actions: string[] = [];
      const events = run(s, 15, has('caught'), () => actions.push(s.actors[0].action));
      expect(events).toContainEqual({ type: 'caught', petId: s.pets[0].id });
      const paw = actions.indexOf('paw');
      expect(actions.indexOf('pounce')).toBeGreaterThanOrEqual(0);
      expect(actions.indexOf('pounce')).toBeLessThan(paw);
    });
  }

  it('止めたねこじゃらしにも、少し身をかがめてから飛びつく', () => {
    const s = setup(['mike'], 'room', [{ x: -0.8, z: -1 }]);
    s.world.wand = { x: 0.3, z: 0, moving: true };
    run(s, 0.1);
    s.world.wand = { x: 0.3, z: 0, moving: false };
    const actions: string[] = [];
    const events = run(s, 10, has('caught'), () => actions.push(s.actors[0].action));
    expect(events).toContainEqual({ type: 'caught', petId: s.pets[0].id });
    expect(actions).toContain('down');
    expect(actions).toContain('pounce');
  });

  it('高く持ち上げたねこじゃらしには、伸び上がって前足で打ち、跳びついて捕まえると噛む', () => {
    const s = setup(['mike'], 'room', [{ x: -0.8, z: -1 }]);
    const actions = new Set<string>();
    const events = run(s, 20, has('caught'), (t) => {
      s.world.wand = { x: 0.3 + Math.sin(t) * 0.05, y: 0.4, z: 0, moving: true };
      actions.add(s.actors[0].action);
    });
    expect(events).toContainEqual({ type: 'caught', petId: s.pets[0].id });
    expect(actions).toContain('jump');
    expect(actions).not.toContain('pounce');
    run(s, 0.2);
    expect(['eat', 'roll']).toContain(s.actors[0].action);
  });

  it('犬はねこじゃらしに 1 度じゃれたら飽きる', () => {
    const s = setup(['shiba'], 'room', [{ x: 0, z: 0 }]);
    s.actors[0].wandPlay = true;
    const actions: string[] = [];
    run(s, 12, undefined, (t) => {
      s.world.wand = { x: 0.3 + Math.sin(t * 2) * 0.2, z: 0.2, moving: true };
      actions.push(s.actors[0].action);
    });
    expect(actions.filter((a, i) => a === 'paw' && actions[i - 1] !== 'paw')).toHaveLength(1);
    expect(s.actors[0].wandPlay).toBe(false);
  });

  it('選んでいない子は、カメラのすぐ前に居座らない', () => {
    const s = setup(['shiba', 'kuro', 'beagle'], 'room', [
      { x: 0, z: -1 },
      { x: 0, z: 0.8 },
      { x: 0.5, z: 0.9 }
    ]);
    s.world.current = s.pets[0].id;
    let near = 0;
    let frames = 0;
    run(s, 90, undefined, (t) => {
      if (t < 10) return;
      frames++;
      for (const a of s.actors.slice(1)) if (a.z > ROOM.front.z - 0.4) near++;
    });
    expect(near / frames).toBeLessThan(0.05);
  });

  it('選んだ子を呼ぶと、front のそばのほかの子は場所をあける', () => {
    const s = setup(['shiba', 'kuro'], 'room', [
      { x: 0, z: -1.2 },
      { x: 0.1, z: 0.85 }
    ]);
    s.world.current = s.pets[0].id;
    const other = s.actors[1];
    other.t = 30;
    command(s.actors[0], s.pets[0], { type: 'call' });
    run(s, 4);
    expect(other.z).toBeLessThan(ROOM.front.z - 0.4);
  });

  it('げんきが少ないとベッドへ行って寝て、起こすと起きる', () => {
    const s = setup(['saba']);
    s.pets[0].stats.energy = 10;
    const events = run(s, 20, has('sleep'));
    expect(events).toContainEqual({ type: 'sleep', petId: s.pets[0].id });
    const a = s.actors[0];
    run(s, 0.5);
    expect(a.asleep).toBe(true);
    expect(a.action).toBe('sleep');
    expect(Math.hypot(a.x - ROOM.bed.x, a.z - ROOM.bed.z)).toBeLessThan(0.2);
    command(a, s.pets[0], { type: 'wake' });
    expect(run(s, 0.1)).toContainEqual({ type: 'wake', petId: s.pets[0].id });
    expect(a.asleep).toBe(false);
  });

  it('なでているあいだは happy で止まり、芸が成功するとそのかっこうをする', () => {
    const s = setup(['poodle']);
    const a = s.actors[0];
    for (let i = 0; i < 30; i++) {
      command(a, s.pets[0], { type: 'stroke' });
      run(s, 0.1);
    }
    expect(a.action).toBe('happy');
    expect(a.v).toBe(0);
    command(a, s.pets[0], { type: 'trick', trick: 'paw', success: true });
    run(s, 0.8);
    expect(a.action).toBe('paw');
  });

  it('床の点を指して呼ぶと、そこまで来て座る', () => {
    const s = setup(['kuro'], 'room', [{ x: -1, z: -1 }]);
    const a = s.actors[0];
    const to = { x: 0.8, z: 0.4 };
    command(a, s.pets[0], { type: 'call', to });
    run(s, 12, () => a.mode === 'idle');
    expect(Math.hypot(a.x - to.x, a.z - to.z)).toBeLessThan(0.15);
    run(s, 0.5);
    expect(a.action).toBe('sit');
  });

  for (const scene of ['room', 'park'] as const) {
    it(`${scene}: 3 匹が歩き回ってもブロックと範囲から出ない`, () => {
      const s = setup(['shiba', 'kuro', 'beagle'], scene, [
        { x: 0, z: 0 },
        { x: 0.1, z: 0 },
        { x: -0.1, z: 0.05 }
      ]);
      if (scene === 'park') s.world.presents = [{ id: 1, x: 1.7, z: -1.1 }];
      const layout = scene === 'room' ? ROOM : PARK;
      const b = layout.bounds;
      run(s, 120, undefined, (t) => {
        if (Math.abs(t % 20) < 1 / 30) s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.8 }, { x: 1, y: 2, z: -4 });
        for (const a of s.actors as Actor[]) {
          expect(a.x).toBeGreaterThanOrEqual(b.x0);
          expect(a.x).toBeLessThanOrEqual(b.x1);
          expect(a.z).toBeGreaterThanOrEqual(b.z0);
          expect(a.z).toBeLessThanOrEqual(b.z1);
          for (const k of layout.blocks) expect(Math.hypot(a.x - k.x, a.z - k.z)).toBeGreaterThan(k.r + 0.1);
        }
      });
    });
  }
});
