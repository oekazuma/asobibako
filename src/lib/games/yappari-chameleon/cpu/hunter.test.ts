import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { HunterBrain, LOOK_SECS } from './hunter';
import { SKILLS, type Strength } from './levels';
import { nearest, NODES, ROOMS } from './paths';
import type { Ctx } from './senses';

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
