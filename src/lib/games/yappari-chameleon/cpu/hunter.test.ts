import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion, placeOf, SPAWNS } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { bodyPoints, sight } from '../oversight';
import { poseById } from '../poses';
import { COOLDOWN, DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { capsules, fire, placement } from '../shots';
import { OPEN } from './fixtures';
import { CHECK, deviate, HunterBrain, LOOK_SECS, SEARCH_REACH, SHOOT_AT, toLook } from './hunter';
import { SKILLS, type Strength } from './levels';
import { nearest, NODES, ROOMS } from './paths';
import type { Ctx, Senses } from './senses';

const lv = levelOf(mansion());
const search: View = {
  ...view(newMatch()),
  phase: 'search',
  settings: { ...DEFAULTS, mode: 'normal' },
  roles: { 1: 'hider', 2: 'hunter' }
};

const body = (pos: V3): Me => ({
  ms: 0,
  pos,
  yaw: 0,
  cling: null,
  pose: 'stand',
  crouch: false,
  paint: false,
  look: [0, 0],
  eye: null
});

function ctx(over: Partial<Ctx> = {}): Ctx & { shots: Message[] } {
  const shots: Message[] = [];
  return {
    me: 2,
    view: search,
    level: lv,
    bodies: new Map(),
    senses: null,
    now: 0,
    act: (m) => shots.push(m),
    shots,
    ...over
  };
}

const brain = (s: Strength, index = 0, rand = rng(3)) => new HunterBrain(NODES.entrance, 0, SKILLS[s], index, rand);

/** secs 秒進め、見回しを始めた部屋を順に集める（同じ部屋を続けて見たら 2 回数える） */
function patrol(b: HunterBrain, c: Ctx, secs: number): string[] {
  const rooms: string[] = [];
  let last: string | null = null;
  for (let t = 0; t < secs; t += 0.05) {
    c.now += 50;
    b.step(c, 0.05);
    if (b.scanning && b.scanning !== last) rooms.push(b.scanning);
    last = b.scanning;
  }
  return rooms;
}

describe('探す CPU の見回り', () => {
  it('入口から入り、2 人なら別々の部屋から回り始める', () => {
    expect(brain('normal', 0).walker.path.at(-1)).toBe(ROOMS[0].look);
    expect(brain('normal', 1).walker.path.at(-1)).toBe(ROOMS[3].look);
  });

  it('部屋に着くと左右と上下に首を振る（見上げて天井と回廊、見下ろして家具の上）', () => {
    const b = brain('normal');
    const c = ctx();
    const pitch: number[] = [];
    const yaw: number[] = [];
    for (let t = 0; t < 30 && pitch.length < LOOK_SECS / 0.05; t += 0.05) {
      b.step(c, 0.05);
      if (b.scanning) {
        pitch.push(b.look[1]);
        yaw.push(b.look[0]);
      }
    }
    expect(Math.min(...pitch)).toBeLessThan(-0.4);
    expect(Math.max(...pitch)).toBeGreaterThan(0.2);
    expect(Math.max(...yaw) - Math.min(...yaw)).toBeGreaterThan(2);
  });

  it('強いは、机や台の下をのぞける部屋（書斎・キッチン・ランドリー）の見回しでだけしゃがみ、普通はしゃがまない', () => {
    const where = (s: Strength) => {
      const b = brain(s);
      const c = ctx();
      const rooms = new Set<string>();
      for (let t = 0; t < 150; t += 0.05) {
        b.step(c, 0.05);
        if (!b.crouch) continue;
        rooms.add(b.scanning ?? '歩くあいだ');
        expect(b.eye()[1]).toBeCloseTo(b.walker.body.pos[1] + EYE_HEIGHT - CROUCH);
        expect(b.me(0).pose).toBe('crouch');
      }
      return [...rooms].sort();
    };
    expect(where('strong')).toEqual(
      ROOMS.filter((r) => r.low)
        .map((r) => r.name)
        .sort()
    );
    expect(where('normal')).toEqual([]);
  });

  it('普通は決まった順、強いはまだ見ていない部屋から、弱いは同じ部屋も見に行く', () => {
    expect(patrol(brain('normal'), ctx(), 150).slice(0, 6)).toEqual(ROOMS.map((r) => r.name));
    expect(new Set(patrol(brain('strong'), ctx(), 150).slice(0, 6)).size).toBe(6);
    expect(
      patrol(
        brain('weak', 0, () => 0),
        ctx(),
        40
      ).slice(0, 3)
    ).toEqual(['大広間', '大広間', '大広間']);
  });

  it('歩く速さは強さの段のぶん', () => {
    expect(brain('weak').walker).toMatchObject({ pace: 0.6, run: false });
    expect(brain('strong').walker).toMatchObject({ pace: 1, run: true });
  });

  it('口笛を聞いたら、ずらした先へ向かう。遠いほど・弱いほど大きく、強いでも 0.5m より離す', () => {
    const at: V3 = [-16, 0, 12];
    const off = (s: Strength, from: V3 = NODES.entrance) => {
      const b = new HunterBrain(from, 0, SKILLS[s], 0, () => 0.5);
      b.heard(at);
      expect(b.walker.path.at(-1)).toBe(nearest(b.goal!));
      return Math.hypot(b.goal![0] - at[0], b.goal![2] - at[2]);
    };
    expect(off('weak')).toBeGreaterThan(off('normal'));
    expect(off('normal')).toBeGreaterThan(off('strong'));
    expect(off('strong')).toBeGreaterThan(0.5);
    expect(off('normal', NODES.kitchen)).toBeLessThan(off('normal'));
  });

  it('口笛の先に着くと、口笛のほうを向いて見回し、そのあと途中だった見回りに戻る', () => {
    const b = brain('normal');
    b.heard([4, 0, 3]);
    const c = ctx();
    for (let t = 0; t < 10 && !b.scanning; t += 0.05) b.step(c, 0.05);
    expect(b.scanning).toBe('大広間');
    expect(b.goal).not.toBeNull();
    for (let t = 0; t < LOOK_SECS + 1 && b.goal; t += 0.05) b.step(c, 0.05);
    expect(b.goal).toBeNull();
    for (let t = 0; t < 10 && !b.scanning; t += 0.05) b.step(c, 0.05);
    expect(b.scanning).toBe(ROOMS[0].name);
  });

  it('埋まりの矢印が出た人の場所へ向かう', () => {
    const b = brain('normal');
    const at: V3 = [-18, 0, -1.6];
    b.step(ctx({ view: { ...search, exposed: [1] }, bodies: new Map<Seat, Me>([[1, body(at)]]) }), 0.05);
    expect(b.goal).toEqual(at);
    expect(b.walker.path.at(-1)).toBe(nearest(at));
  });

  it('答え合わせでは歩かずにその場で見回す', () => {
    const b = brain('normal');
    const c = ctx({ view: { ...search, phase: 'reveal' } });
    const from = [...b.walker.body.pos];
    const yaws = new Set<number>();
    for (let t = 0; t < 3; t += 0.05) {
      b.step(c, 0.05);
      yaws.add(Math.round(b.look[0] * 10));
    }
    expect(b.walker.body.pos[0]).toBeCloseTo(from[0]);
    expect(b.walker.body.pos[2]).toBeCloseTo(from[2]);
    expect(yaws.size).toBeGreaterThan(3);
  });

  it('体は構えたポーズで、目の位置を付けて送る', () => {
    const m = brain('normal').me(123);
    expect(m).toMatchObject({ ms: 123, pose: 'aim', crouch: false, cling: null, paint: false });
    expect(m.eye).toEqual([NODES.entrance[0], NODES.entrance[1] + EYE_HEIGHT, NODES.entrance[2]]);
    expect(m.look).toEqual([0, 0]);
  });
});

/** 決め打ちの目。visible は vis を返し、聞かれた席を calls に入れる */
function eyes(vis: number | null, calls: Seat[] = []): Senses {
  return {
    visible: (seat) => {
      calls.push(seat);
      return vis;
    },
    colorAt: () => null,
    surface: () => null
  };
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** 弾の向きと、目から体の胴の真ん中への向きのあいだの角度（度） */
function miss(shot: Message, target: Me): number {
  const o = shot.o as V3;
  const [mid] = bodyPoints(target);
  const want = norm([mid[0] - o[0], mid[1] - o[1], mid[2] - o[2]]);
  return (Math.acos(Math.min(1, dot(shot.d as V3, want))) * 180) / Math.PI;
}

function hunt(s: Strength, senses: Senses | null, at: V3 = OPEN, rand = rng(5)) {
  const b = brain(s, 0, rand);
  const target = body(at);
  const c = ctx({ senses, bodies: new Map<Seat, Me>([[1, target]]) });
  const run = (secs: number, each?: (t: number) => void) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      c.now += 50;
      b.step(c, 0.05);
      each?.(t);
    }
  };
  return { b, c, target, run };
}

describe('探す CPU の気づきと撃つ', () => {
  it('的の点は、どの種の置き方でも入口の 3 席と大広間の見回す点から胴が見える', () => {
    const [mid] = bodyPoints(body(OPEN));
    for (const seed of [null, ...Array.from({ length: 50 }, (_, i) => i + 1)]) {
      const level = levelOf(mansion(seed));
      for (const f of [NODES.hall, ...Object.values(SPAWNS.entrance)]) {
        const eye: V3 = [f[0], f[1] + EYE_HEIGHT, f[2]];
        const look: [number, number] = [Math.atan2(mid[0] - eye[0], mid[2] - eye[2]), 0];
        expect(sight(level, { eye, look }, [mid], SEARCH_REACH), `${seed} ${f}`).not.toBeNull();
      }
    }
  });

  it('目立つ体は見つけて、狙いを強さの段の度数だけずらして撃つ', () => {
    const { c, target, run } = hunt('normal', eyes(0.6));
    run(4);
    expect(c.shots.length).toBeGreaterThan(0);
    const shot = c.shots[0];
    expect(miss(shot, target)).toBeCloseTo(SKILLS.normal.aim, 1);
    expect(shot.ms).toBeGreaterThan(0);
    // 筋は目より少し下の銃口から
    expect((shot.from as V3)[1]).toBeLessThan((shot.o as V3)[1]);
  });

  it('撃つと決めてから撃つまで、強さの段のぶん迷う', () => {
    const waited = (s: Strength) => {
      const { b, c, run } = hunt(s, eyes(1));
      let decided: number | null = null;
      let shot: number | null = null;
      run(10, (t) => {
        if (decided === null && (b.suspicion.get(1) ?? 0) >= SHOOT_AT) decided = t;
        if (shot === null && c.shots.length) shot = t;
      });
      return shot! - decided!;
    };
    expect(waited('strong')).toBeCloseTo(SKILLS.strong.wait, 0);
    expect(waited('weak')).toBeCloseTo(SKILLS.weak.wait, 0);
    expect(waited('weak') - waited('strong')).toBeGreaterThan(0.9);
  });

  it('目立たない体は、止まっていれば見落とす', () => {
    const { b, c, run } = hunt('strong', eyes(0));
    run(30);
    expect(c.shots).toEqual([]);
    expect(b.suspicion.get(1)).toBe(0);
  });

  it('目立たない体でも、動けば気づいて撃つ', () => {
    const { c, target, run } = hunt('normal', eyes(0));
    let k = 0;
    run(8, () => {
      if (!c.shots.length) target.pos = [OPEN[0] + 0.1 * (k++ % 2), 0, OPEN[2]];
    });
    expect(c.shots.length).toBeGreaterThan(0);
  });

  it('3D が描けていない（目立ちが null）あいだも、動く体には気づき、止まった体は見落とす', () => {
    const still = hunt('normal', eyes(null));
    still.run(15);
    expect(still.c.shots).toEqual([]);
    const moving = hunt('normal', null);
    let k = 0;
    moving.run(8, () => {
      if (!moving.c.shots.length) moving.target.pos = [OPEN[0] + 0.1 * (k++ % 2), 0, OPEN[2]];
    });
    expect(moving.c.shots.length).toBeGreaterThan(0);
  });

  it('目立ちは 1 体につき 1 秒に 4 回までしか聞かない', () => {
    const calls: Seat[] = [];
    const { run } = hunt('normal', eyes(0, calls));
    run(10);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(10 / CHECK + 1);
  });

  it('壁の向こうの体には目立ちを聞かない', () => {
    const calls: Seat[] = [];
    const { c, run } = hunt('strong', eyes(1, calls), [-18, 0, 12]);
    run(5);
    expect(calls).toEqual([]);
    expect(c.shots).toEqual([]);
  });

  it('撃つ間の 2 秒は自分で守る', () => {
    const { c, run } = hunt('strong', eyes(1));
    run(10);
    expect(c.shots.length).toBeGreaterThan(2);
    for (let i = 1; i < c.shots.length; i++)
      expect((c.shots[i].ms as number) - (c.shots[i - 1].ms as number)).toBeGreaterThanOrEqual(COOLDOWN * 1000 - 1);
  });

  it('答え合わせでは撃たない', () => {
    const { c, run } = hunt('strong', eyes(1));
    c.view = { ...search, phase: 'reveal' };
    run(5);
    expect(c.shots).toEqual([]);
  });

  it('壁の向こうへ逃げた体は、最後に見えた所までは追うが、その先の本当の位置へは行かず、見えないあいだは撃たない', () => {
    const { b, c, target, run } = hunt('normal', eyes(1));
    let fled = false;
    // 撃つと決めたらすぐ、大広間からは壁で見えないキッチンへ逃げる
    run(3, () => {
      if (fled || (b.suspicion.get(1) ?? 0) < SHOOT_AT) return;
      fled = true;
      target.pos = [-18, 0, 12];
    });
    expect(fled).toBe(true);
    const last = nearest(OPEN);
    const places = new Set<string>();
    let reached = false;
    let faced = false;
    run(10, () => {
      places.add(placeOf(b.walker.body.pos));
      for (const n of b.walker.path) places.add(placeOf(NODES[n]));
      if (Math.hypot(b.walker.body.pos[0] - NODES[last][0], b.walker.body.pos[2] - NODES[last][2]) < 0.3)
        reached = true;
      if (b.goal && Math.hypot(b.goal[0] - OPEN[0], b.goal[2] - OPEN[2]) < 0.3) faced = true;
    });
    expect(c.shots).toEqual([]);
    expect(reached).toBe(true);
    expect(faced).toBe(true);
    expect([...places]).toEqual(['大広間']);
  });

  it('見つかった体は狙うのをやめる', () => {
    const { c, run } = hunt('strong', eyes(1));
    run(4);
    const n = c.shots.length;
    expect(n).toBeGreaterThan(0);
    c.view = { ...search, found: [1] };
    run(6);
    expect(c.shots.length).toBe(n);
  });

  it('半端に怪しい見えている体へは、ときどき試し撃ちする（ずれは 2 倍）', () => {
    const { b, c, target, run } = hunt('normal', eyes(0), OPEN, () => 0);
    b.suspicion.set(1, 0.6);
    run(0.3);
    expect(c.shots).toHaveLength(1);
    expect(miss(c.shots[0], target)).toBeCloseTo(SKILLS.normal.aim * 2, 1);
  });

  it('胴が箱に隠れて頭だけ見える体は、見えている頭を狙い、強いなら 20 秒以内に撃ち当てる', () => {
    // 体のまわりを高さ 0.95m の囲いで囲む。目の高さ 1m から、頭（1.045m）は見えて胴の真ん中（0.70m）は見えない
    const [x, , z] = OPEN;
    const wall = (x0: number, z0: number, x1: number, z1: number) => ({
      min: [x0, 0, z0] as V3,
      max: [x1, 0.95, z1] as V3
    });
    const pen: typeof lv = {
      ...lv,
      boxes: [
        ...lv.boxes,
        wall(x - 0.45, z - 0.45, x + 0.45, z - 0.4),
        wall(x - 0.45, z + 0.4, x + 0.45, z + 0.45),
        wall(x - 0.45, z - 0.45, x - 0.4, z + 0.45),
        wall(x + 0.4, z - 0.45, x + 0.45, z + 0.45)
      ]
    };
    const { c, target, run } = hunt('strong', eyes(1));
    c.level = pen;
    const caps = [{ seat: 1, caps: capsules(poseById(target.pose), placement(target)) }];
    let hit: number | null = null;
    let seen = 0;
    run(20, (t) => {
      for (const shot of c.shots.slice(seen)) {
        if (hit === null && fire(pen, shot.o as V3, shot.d as V3, caps).some((r) => r.seat === 1)) {
          hit = t;
          c.view = { ...search, found: [1] };
        }
      }
      seen = c.shots.length;
    });
    expect(c.shots.length).toBeGreaterThan(0);
    expect(hit).not.toBeNull();
  });

  it('見えたまま 3 発撃っても見つからなければ、体のそばの点まで寄る', () => {
    const { b, c, target, run } = hunt('strong', eyes(1));
    const near = nearest(bodyPoints(target)[0]);
    let walked = false;
    run(12, () => {
      if (c.shots.length < 3) expect(b.walker.path.at(-1)).not.toBe(near);
      else if (b.walker.path.at(-1) === near) walked = true;
    });
    expect(walked).toBe(true);
  });

  it('怪しさには上限があり、見失って 30 秒たてば撃ちに行く線より下がる', () => {
    const { b, target, run } = hunt('strong', eyes(1));
    run(60);
    target.pos = [60, 0, 60];
    run(30);
    expect(b.suspicion.get(1)).toBeLessThan(SHOOT_AT);
  });

  it('2 人の探す CPU は、同じコマで目立ちを聞かない', () => {
    const steps = [new Set<number>(), new Set<number>()];
    let k = 0;
    const two = [0, 1].map((i) => {
      const b = brain('normal', i);
      const senses = { ...eyes(0), visible: () => (steps[i].add(k), 0) };
      const v: View = { ...search, roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' } };
      return { b, c: ctx({ me: (2 + i) as Seat, view: v, senses, bodies: new Map<Seat, Me>([[1, body(OPEN)]]) }) };
    });
    for (; k < 200; k++)
      for (const { b, c } of two) {
        c.now += 50;
        b.step(c, 0.05);
      }
    expect(steps[0].size).toBeGreaterThan(0);
    expect(steps[1].size).toBeGreaterThan(0);
    expect([...steps[0]].filter((s) => steps[1].has(s))).toEqual([]);
  });

  it('toLook は弾の向きの yaw と pitch（下向きが正）、deviate はちょうどその度数だけずらす', () => {
    const [yaw, pitch] = toLook([0, 0, 1]);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
    expect(toLook(norm([1, -1, 0]))).toEqual([expect.closeTo(Math.PI / 2), expect.closeTo(Math.PI / 4)]);
    const d = deviate([0, 0, 1], 3, () => 0.3);
    expect((Math.acos(d[2]) * 180) / Math.PI).toBeCloseTo(3, 5);
  });
});
