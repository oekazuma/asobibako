import { describe, expect, it } from 'vitest';
import { Cheerer, Fight, stats, TIME_LIMIT, type FightEvent } from './battle';
import { hatch } from './engine';
import { lineup } from './rivals';

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
});
