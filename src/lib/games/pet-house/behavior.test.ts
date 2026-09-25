import { describe, expect, it } from 'vitest';
import { Rng } from '$lib/levels';
import {
  command,
  createActor,
  naughty,
  playing,
  think,
  throwToy,
  type Actor,
  type BehaviorEvent,
  type WorldView
} from './behavior';
import { NATURAL_ROOM } from './decor';
import { adopt, newSave, rest, type Pet } from './engine';
import { LAYOUTS, PARK, ROOM, roomPerches, type Perch, type Spot } from './layout';
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
  it('汚れがいちばんひどいと、ひまなときにときどき体をかく。きれいならかかない', () => {
    const count = (clean: number) => {
      const s = setup(['shiba', 'mike'], 'room', [
        { x: -0.6, z: 0.3 },
        { x: 0.6, z: -0.5 }
      ]);
      for (const p of s.pets) [p.stats.clean, p.stats.food, p.stats.water, p.stats.energy] = [clean, 100, 100, 100];
      let scratches = 0;
      let was = false;
      run(s, 90, undefined, () => {
        const now = s.actors.some((a) => a.action === 'scratch');
        if (now && !was) scratches++;
        was = now;
      });
      return scratches;
    };
    expect(count(5)).toBeGreaterThanOrEqual(3);
    expect(count(60)).toBe(0);
  });

  it('おなかがすいていると、お皿へ行って食べ、食べきると ate', () => {
    const s = setup(['shiba']);
    s.pets[0].stats.food = 20;
    s.world.bowls = { food: 'dogfood', foodLeft: 1, waterLeft: 0 };
    const events = run(s, 25, has('ate'));
    expect(events).toContainEqual({ type: 'ate', petId: s.pets[0].id, food: 'dogfood' });
    expect(s.world.bowls.foodLeft).toBe(0);
    expect(Math.hypot(s.actors[0].x - ROOM.food.x, s.actors[0].z - ROOM.food.z)).toBeLessThan(0.4);
  });

  /** ボールを投げて、犬が持ってきて持ち主の前でくわえて待つところまで回す */
  const fetchToFront = () => {
    const s = setup(['beagle'], 'room', [ROOM.front]);
    s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.9 }, { x: 0.4, y: 1.5, z: -2.6 });
    const events = run(s, 25, has('fetched'), () => (s.actors[0].tease = false));
    expect(events).toContainEqual({ type: 'fetched', petId: s.pets[0].id });
    return s;
  };

  it('ときどき、持ってきたおもちゃを渡す前に少し逃げて「とってごらん」と誘ってから持ってくる', () => {
    const s = setup(['beagle'], 'room', [ROOM.front]);
    s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.9 }, { x: 0.4, y: 1.5, z: -2.6 });
    const a = s.actors[0];
    const actions = new Set<string>();
    const events = run(s, 30, has('fetched'), () => {
      if (a.mode === 'chase') a.tease = true;
      actions.add(a.mode === 'tease' ? 'tease' : a.action);
    });
    expect(actions).toContain('tease');
    expect(actions).toContain('bow');
    expect(events).toContainEqual({ type: 'fetched', petId: s.pets[0].id });
    expect(a.mode).toBe('offer');
  });

  it('投げたボールを犬が取りに行き、持ち主の前でおすわりしてくわえたまま待つ', () => {
    const s = fetchToFront();
    const a = s.actors[0];
    run(s, 1);
    expect(a.mode).toBe('offer');
    expect(a.action).toBe('sit');
    expect(s.world.toy!.holder).toBe(a.petId);
    expect(Math.hypot(a.x - ROOM.front.x, a.z - ROOM.front.z)).toBeLessThan(0.3);
  });

  it('くわえて待つおもちゃを受け取ると喜び、受け取らないと足元に置いて催促する', () => {
    const got = fetchToFront();
    got.world.toy = null;
    run(got, 0.1);
    expect(got.actors[0].carrying).toBeNull();
    expect(got.actors[0].action).toBe('happy');

    const s = fetchToFront();
    const events = run(s, 8, has('urge'));
    expect(events).toContainEqual({ type: 'urge', petId: s.pets[0].id });
    run(s, 2);
    const toy = s.world.toy!;
    expect(toy.holder).toBeNull();
    expect(toy.still).toBe(true);
    expect(Math.hypot(toy.x - ROOM.front.x, toy.z - ROOM.front.z)).toBeLessThan(0.6);
    expect(s.actors[0].carrying).toBeNull();
  });

  it('大会や広場では、持ってきたおもちゃをすぐ front に置く', () => {
    const s = setup(['beagle'], 'room', [ROOM.front]);
    s.world.scene = 'contest';
    s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.9 }, { x: 0.4, y: 1.5, z: -2.6 });
    run(s, 25, has('fetched'));
    expect(s.world.toy!.holder).toBeNull();
    expect(s.actors[0].carrying).toBeNull();
  });

  it('猫はそばへ転がってきたボールを前足で何度も転がして遊び、飽きると離れる', () => {
    // 遊ぶかどうかは気まぐれなので、遊びはじめた回を見る
    let plays = 0;
    for (let seed = 1; seed <= 10 && !plays; seed++) {
      const s = { ...setup(['mike'], 'room', [{ x: -0.3, z: -0.6 }]), rng: new Rng(seed).next };
      const toy = throwToy('ball', { x: 0.6, y: 0.05, z: 0.4 }, { x: -0.5, y: 0, z: -0.6 });
      s.world.toy = toy;
      const spots = new Set<string>();
      const events = run(s, 40, undefined, () => {
        if (s.actors[0].action === 'paw') spots.add(`${toy.x.toFixed(1)},${toy.z.toFixed(1)}`);
      });
      plays = events.filter((e) => e.type === 'played').length;
      if (!plays) continue;
      expect(plays).toBeGreaterThanOrEqual(3);
      expect(spots.size).toBeGreaterThanOrEqual(2);
      expect(s.actors[0].mode).not.toBe('chase');
    }
    expect(plays).toBeGreaterThan(0);
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

  it('お皿に向けて転がしても投げても、おもちゃはお皿に入らず、食べる子の前にも止まらない', () => {
    const rng = new Rng(3).next;
    for (let i = 0; i < 60; i++) {
      const s = setup([], 'room');
      const kind = i % 2 ? 'mouse' : 'ball';
      const bowl = i % 4 < 2 ? ROOM.food : ROOM.water;
      const from = { x: -0.8 + rng() * 1.8, y: kind === 'mouse' ? 0.03 : 0.55, z: -0.3 + rng() * 1.2 };
      const aim = { x: bowl.x + (rng() - 0.5) * 0.2, z: bowl.z + (rng() - 0.5) * 0.2 };
      const len = Math.hypot(aim.x - from.x, aim.z - from.z);
      const h = 1 + rng() * 2.5;
      const toy = throwToy(kind, from, {
        x: ((aim.x - from.x) / len) * h,
        y: kind === 'ball' ? rng() * 2 : 0,
        z: ((aim.z - from.z) / len) * h
      });
      s.world.toy = toy;
      run(
        s,
        30,
        () => toy.still,
        () => {
          for (const k of [ROOM.food, ROOM.water])
            if (toy.y < 0.06) expect(Math.hypot(toy.x - k.x, toy.z - k.z)).toBeGreaterThan(0.12);
        }
      );
      expect(toy.still).toBe(true);
      for (const k of [ROOM.food, ROOM.water]) {
        const inLane = toy.x <= k.x && toy.x > k.x - 0.5 && Math.abs(toy.z - k.z) < 0.18;
        expect(inLane).toBe(false);
      }
    }
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

  it('公園で眠くなると、その場で目を閉じて寝る（伏せて目を開けたままにしない）', () => {
    const s = setup(['shiba'], 'park', [{ x: 0, z: 0 }]);
    s.pets[0].stats.energy = 10;
    expect(run(s, 20, has('sleep')).some((e) => e.type === 'sleep')).toBe(true);
    run(s, 2);
    expect(s.actors[0].action).toBe('sleep');
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
      else s.world.perches = roomPerches(NATURAL_ROOM);
      const layout = scene === 'room' ? ROOM : PARK;
      const b = layout.bounds;
      run(s, 120, undefined, (t) => {
        if (Math.abs(t % 20) < 1 / 30) s.world.toy = throwToy('ball', { x: 0, y: 1, z: 0.8 }, { x: 1, y: 2, z: -4 });
        for (const a of s.actors as Actor[]) {
          if (a.hop) continue;
          const on = s.world.perches?.find((p) => p.id === a.perch);
          if (on) {
            expectOn(a, on);
            continue;
          }
          expect(a.y).toBe(0);
          expect(a.x).toBeGreaterThanOrEqual(b.x0);
          expect(a.x).toBeLessThanOrEqual(b.x1);
          expect(a.z).toBeGreaterThanOrEqual(b.z0);
          expect(a.z).toBeLessThanOrEqual(b.z1);
          for (const k of layout.blocks) expect(Math.hypot(a.x - k.x, a.z - k.z)).toBeGreaterThan(k.r + 0.1);
        }
      });
    });
  }

  describe('ソファとベッド', () => {
    const inRoom = (breeds: BreedId[], at?: Spot[], seed = 7) => {
      const s = setup(breeds, 'room', at);
      s.world.perches = roomPerches(NATURAL_ROOM);
      s.rng = new Rng(seed).next;
      return s;
    };
    const perch = (s: Setup, id: Perch['id']) => s.world.perches!.find((p) => p.id === id)!;

    it('ソファをタップして呼ぶと飛び乗って座面の上で座り、呼ぶと飛び降りて front に来る', () => {
      const s = inRoom(['mike'], [{ x: 0.6, z: 0.3 }]);
      const a = s.actors[0];
      const seat = perch(s, 'sofa');
      // 背もたれの上を指しても、座面の中に収まる
      command(a, s.pets[0], { type: 'call', to: { x: 0.9, z: -2.3 }, perch: 'sofa' });
      let hopped = false;
      run(
        s,
        15,
        () => a.perch === 'sofa' && a.mode === 'idle',
        () => (hopped ||= !!a.hop)
      );
      expect(hopped).toBe(true);
      expectOn(a, seat);
      run(s, 0.5);
      expect(a.action).toBe('sit');

      command(a, s.pets[0], { type: 'call' });
      run(s, 15, () => a.mode === 'idle');
      expect(a.perch).toBeNull();
      expect(a.y).toBe(0);
      expect(Math.hypot(a.x - ROOM.front.x, a.z - ROOM.front.z)).toBeLessThan(0.15);
    });

    it('ソファの上でおすわりはそのまま、ジャンプは降りてからする', () => {
      const s = inRoom(['shiba']);
      const a = s.actors[0];
      command(a, s.pets[0], { type: 'call', to: perch(s, 'sofa'), perch: 'sofa' });
      run(s, 15, () => a.perch === 'sofa' && a.mode === 'idle');
      command(a, s.pets[0], { type: 'trick', trick: 'sit', success: true });
      run(s, 0.5);
      expect(a.perch).toBe('sofa');
      expect(a.action).toBe('sit');
      run(s, 2);
      command(a, s.pets[0], { type: 'trick', trick: 'jump', success: true });
      run(s, 3, () => a.perch === null && a.action === 'jump');
      expect(a.perch).toBeNull();
      expect(a.action).toBe('jump');
    });

    it('眠いときはベッドかソファで寝る。猫はソファを選ぶこともある', () => {
      const where = new Set<string | null>();
      for (let seed = 1; seed <= 20; seed++) {
        const s = inRoom(['saba'], undefined, seed);
        const a = s.actors[0];
        s.pets[0].stats.energy = 10;
        run(s, 30, () => a.asleep);
        where.add(a.asleep ? a.perch : 'awake');
        if (a.perch) expectOn(a, perch(s, a.perch));
      }
      expect(where).toContain('sofa');
      expect(where).toContain('bed');
      expect(where).not.toContain('awake');
    });

    it('ひまな猫はときどき自分でソファに乗る', () => {
      const s = inRoom(['kuro']);
      const a = s.actors[0];
      run(s, 240, () => a.perch === 'sofa' && a.mode === 'idle');
      expectOn(a, perch(s, 'sofa'));
    });
  });
});

function expectOn(a: Actor, p: Perch) {
  expect(a.perch).toBe(p.id);
  expect(a.y).toBe(p.y);
  expect(Math.abs(a.x - p.x)).toBeLessThanOrEqual(p.w + 1e-9);
  expect(Math.abs(a.z - p.z)).toBeLessThanOrEqual(p.d + 1e-9);
}

describe('声の頼みごと', () => {
  const lively = (s: Setup) => {
    for (const p of s.pets) [p.stats.food, p.stats.water, p.stats.clean] = [100, 100, 100];
  };

  it('「ねんね」は、眠くなくてもベッドかソファへ行って寝て、げんきが戻ると起きる', () => {
    const s = setup(['shiba']);
    lively(s);
    s.world.perches = roomPerches(NATURAL_ROOM);
    s.pets[0].stats.energy = 60;
    const a = s.actors[0];
    command(a, s.pets[0], { type: 'sleep' });
    expect(run(s, 20, has('sleep')).some((e) => e.type === 'sleep')).toBe(true);
    expect(a.asleep).toBe(true);
    expect(a.perch).not.toBe(null);
    const woke = run(s, 60, has('wake'), () => a.asleep && rest(s.pets[0], 1 / 30));
    expect(woke.some((e) => e.type === 'wake')).toBe(true);
    expect(s.pets[0].stats.energy).toBeGreaterThanOrEqual(90);
  });

  it('げんきなら、少し横になるだけで寝つかない', () => {
    const s = setup(['mike']);
    lively(s);
    s.pets[0].stats.energy = 95;
    const a = s.actors[0];
    command(a, s.pets[0], { type: 'sleep', brief: true });
    let lay = false;
    const events = run(s, 6, undefined, () => (lay ||= a.action === 'sleep'));
    expect(lay).toBe(true);
    expect(events.some((e) => e.type === 'sleep')).toBe(false);
    expect(a.asleep).toBe(false);
    expect(a.action).not.toBe('sleep');
  });

  it('「おきて」はのびをして起きる', () => {
    const s = setup(['shiba']);
    lively(s);
    s.pets[0].stats.energy = 20;
    const a = s.actors[0];
    run(s, 20, () => a.asleep);
    expect(a.asleep).toBe(true);
    command(a, s.pets[0], { type: 'wake', stretch: true });
    expect(a.asleep).toBe(false);
    run(s, 0.2);
    expect(a.action).toBe('bow');
  });

  it('「まて」のあいだは、なでても転がるおもちゃが来ても座って待ち、よぶと来る', () => {
    const s = setup(['shiba']);
    lively(s);
    const a = s.actors[0];
    command(a, s.pets[0], { type: 'stay', t: 12 });
    const at = { x: a.x, z: a.z };
    s.world.toy = throwToy('ball', { x: a.x + 0.8, y: 0.05, z: a.z - 0.3 }, { x: -1, y: 0, z: 0 });
    run(s, 10, undefined, (t) => {
      if (t > 2 && t < 4) command(a, s.pets[0], { type: 'stroke', part: 'head', amount: 1 / 30 });
    });
    expect(a.stay).toBe(true);
    expect(a.action).toBe('sit');
    expect(Math.hypot(a.x - at.x, a.z - at.z)).toBeLessThan(0.15);
    command(a, s.pets[0], { type: 'call' });
    expect(a.stay).toBe(false);
    expect(a.mode).toBe('go');
  });

  it('「まて」は時間が尽きると自分で立つ', () => {
    const s = setup(['mike']);
    lively(s);
    const a = s.actors[0];
    command(a, s.pets[0], { type: 'stay', t: 3 });
    run(s, 3.5);
    expect(a.stay).toBe(false);
  });

  it('「だめ」で、おもちゃを追うのをやめて伏せ、すぐ元にもどる', () => {
    const s = setup(['shiba']);
    lively(s);
    const a = s.actors[0];
    s.world.toy = throwToy('ball', { x: a.x, y: 0.55, z: a.z }, { x: 0, y: 1, z: -2.5 });
    run(s, 0.5, () => a.mode === 'chase');
    expect(naughty(a)).toBe(true);
    a.seen = s.world.toy;
    command(a, s.pets[0], { type: 'scold' });
    run(s, 0.2);
    expect(a.action).toBe('down');
    expect(playing(a)).toBe(false);
    run(s, 4);
    expect(a.mode).not.toBe('chase');
    expect(a.action).not.toBe('down');
  });

  it('「あそぼ」は、おじぎで誘ってから走りまわる', () => {
    const s = setup(['shiba']);
    lively(s);
    const a = s.actors[0];
    command(a, s.pets[0], { type: 'play' });
    run(s, 0.2);
    expect(a.action).toBe('bow');
    let ran = 0;
    run(s, 8, undefined, () => (ran += a.action === 'run' ? 1 : 0));
    expect(ran).toBeGreaterThan(30);
  });

  it('写真は、カメラの方を向いて座る', () => {
    const s = setup(['mike']);
    lively(s);
    const a = s.actors[0];
    a.heading = Math.PI;
    command(a, s.pets[0], { type: 'face' });
    run(s, 1);
    expect(a.action).toBe('sit');
    expect(Math.abs(Math.atan2(Math.sin(a.heading), Math.cos(a.heading)))).toBeLessThan(0.5);
  });
});
