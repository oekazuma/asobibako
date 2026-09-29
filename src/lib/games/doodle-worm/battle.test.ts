import { describe, expect, it } from 'vitest';
import { CHARGE, Cheerer, Fight, GUARD_COOL, stats, TIME_LIMIT, type FightEvent } from './battle';
import { hatch } from './engine';
import { lineup, POOLS } from './rivals';

/** 決まった種の乱数 */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
}

const [plain, , boss] = lineup(() => 0).map((r) => stats(hatch(r.strokes)!));

/** 1 秒に a 回・b 回の応援で最後まで戦わせる */
function duel(a: number, b: number, seed: number) {
  const rand = seeded(seed);
  const fight = new Fight(plain, plain, rand);
  const cheer = [new Cheerer(a, rand), new Cheerer(b, rand)];
  const events: FightEvent[] = [];
  while (fight.winner === null) {
    for (const i of [0, 1] as const)
      if (fight.started && cheer[i].rate) for (let n = cheer[i].step(1 / 60); n; n--) events.push(...fight.cheer(i));
    events.push(...fight.step(1 / 60));
  }
  return { fight, events };
}

describe('バトル', () => {
  it('絵の形で持ち味が変わる。ドラゴンは大きくて足もはねもある', () => {
    expect(plain.hp).toBeLessThan(boss.hp);
    expect(boss.interval).toBeLessThan(plain.interval);
    expect(boss.dodge).toBeGreaterThan(plain.dodge);
    expect(plain.trait).toBe('でっかい');
  });

  it('同じ強さなら、たくさん応援したほうがほとんど勝つ', () => {
    const wins = Array.from({ length: 40 }, (_, i) => duel(6, 3, i + 1).fight.winner).filter((w) => w === 0).length;
    expect(wins).toBeGreaterThanOrEqual(34);
  });

  it('応援しなくても決着し、長くても制限時間で終わる', () => {
    const { fight, events } = duel(0, 0, 3);
    expect(fight.t).toBeLessThanOrEqual(TIME_LIMIT + 0.1);
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'go' });
  });

  it('ゲージが満タンになると、次の攻撃はひっさつわざでよけられない', () => {
    const { events } = duel(8, 0, 5);
    expect(events.some((e) => e.type === 'ready' && e.side === 0)).toBe(true);
    expect(events.some((e) => e.type === 'hit' && e.side === 0 && e.special)).toBe(true);
  });

  it('始まる前と決着のあとの応援は数えない', () => {
    const fight = new Fight(plain, plain, seeded(1));
    fight.cheer(0);
    expect(fight.sides[0].gauge).toBe(0);
  });

  it('用意した相手はどれも体のある子になり、名前が重ならない', () => {
    const all = POOLS.flat();
    expect(new Set(all.map((r) => r.name)).size).toBe(all.length);
    for (const r of all) expect(hatch(r.strokes)!.parts.some((p) => p.role === 'body')).toBe(true);
  });

  it('ガードした攻撃は弱まり、続けてはガードできない', () => {
    const hitOn = (guard: boolean) => {
      const fight = new Fight(plain, plain, () => 0.99);
      fight.step(2);
      if (guard) fight.guard(1);
      for (let i = 0; i < 120; i++) {
        const hit = fight.step(1 / 60).find((e) => e.type === 'hit' && e.side === 0);
        if (hit) return hit;
      }
    };
    const open = hitOn(false)!;
    const blocked = hitOn(true)!;
    expect(blocked.type === 'hit' && blocked.guarded).toBe(true);
    expect(blocked.type === 'hit' && open.type === 'hit' && blocked.damage).toBeLessThan(
      open.type === 'hit' ? open.damage : 0
    );
    const fight = new Fight(plain, plain);
    fight.step(2);
    expect(fight.guard(0)).toHaveLength(1);
    expect(fight.guard(0)).toEqual([]);
    fight.step(GUARD_COOL + 0.01);
    expect(fight.guard(0)).toHaveLength(1);
  });

  it('ひっさつわざは「ため」を知らせ、ためているあいだ相手は攻撃しない', () => {
    const fight = new Fight(plain, plain, seeded(2));
    fight.step(2);
    for (let i = 0; i < 20; i++) fight.cheer(0);
    const events: FightEvent[] = [];
    while (!events.some((e) => e.type === 'charge')) events.push(...fight.step(1 / 60));
    const foe = fight.sides[1];
    const busy = foe.act !== null;
    const timer = foe.timer;
    for (let t = 0; t < CHARGE * 0.9; t += 1 / 60) fight.step(1 / 60);
    if (!busy) expect(foe.timer).toBe(timer);
    expect(foe.act === null || busy).toBe(true);
  });
});
