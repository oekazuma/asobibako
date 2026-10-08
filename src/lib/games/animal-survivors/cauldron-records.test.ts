import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { betOf } from './cauldron';
import { emptyRecords, parseRecords, payHeat, record } from './records';
import { createWorld, summary } from './world';

const VIEW = { w: 274, h: 394 };
const runAt = (level: number, cleared: boolean) => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level, bet: betOf(level) } });
  w.time = cleared ? 600 : 200;
  w.over = cleared ? 'clear' : 'dead';
  return summary(w);
};

describe('釜の賭け', () => {
  it('はじめるときに賭けを引き、最後の強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 5000 };
    const heat = payHeat(r, 4.5);
    expect(heat).toEqual({ level: 4.5, bet: betOf(4.5) });
    expect(r.coins).toBe(5000 - betOf(4.5));
    expect(r.heatLast).toBe(4.5);
  });

  it('コインが足りなければ払える強さまで下げ、負にならない', () => {
    const r = { ...emptyRecords(), coins: 100 };
    const heat = payHeat(r, 9);
    expect(heat.level).toBeLessThan(9);
    expect(r.coins).toBeGreaterThanOrEqual(0);
    expect(heat.bet).toBeLessThanOrEqual(100);
    const z = { ...emptyRecords(), coins: 0 };
    expect(payHeat(z, 1.5)).toEqual({ level: 1.5, bet: 0 });
  });

  it('クリアで賭けが戻り、ステージのいちばん高い強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = runAt(4.5, true);
    record(r, run);
    expect(r.coins).toBe(run.coins + betOf(4.5) + (run.bookCoins ?? 0) + achieved(r));
    expect(r.heat.forest).toBe(4.5);
    record(r, runAt(3, true));
    expect(r.heat.forest).toBe(4.5);
  });

  it('倒れたら賭けは戻らず、強さも記録しない', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = runAt(4.5, false);
    record(r, run);
    expect(r.coins).toBe(run.coins + (run.bookCoins ?? 0) + achieved(r));
    expect(r.heat.forest).toBeUndefined();
  });

  it('延長戦の終わりの記録では賭けを戻さない', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = { ...runAt(4.5, false), overtime: { secs: 30, coins: 0, halved: false } };
    const before = r.coins;
    record(r, run);
    expect(r.coins - before).toBe(run.coins + (run.bookCoins ?? 0) + achieved(r));
  });

  it('古い記録は heat が空、heatLast が 2.0 で読め、壊れた値は捨てる', () => {
    const r = parseRecords(JSON.stringify({ coins: 5 }));
    expect(r.heat).toEqual({});
    expect(r.heatLast).toBe(2);
    const bad = parseRecords(JSON.stringify({ heat: { forest: 'x', snow: 99, graveyard: 3.3 }, heatLast: -4 }));
    expect(bad.heat).toEqual({ snow: 9, graveyard: 3.3 });
    expect(bad.heatLast).toBe(0);
  });

  it('釜 5.0 以上・9.0 でクリアの実績', () => {
    const r = emptyRecords();
    const a5 = ACHIEVEMENTS.find((a) => a.id === 'heat5')!;
    const a9 = ACHIEVEMENTS.find((a) => a.id === 'heat9')!;
    expect(a5.done(r, null)).toBe(false);
    r.heat.snow = 5;
    expect(a5.done(r, null)).toBe(true);
    expect(a9.done(r, null)).toBe(false);
    r.heat.forest = 9;
    expect(a9.done(r, null)).toBe(true);
  });
});

function achieved(r: ReturnType<typeof emptyRecords>) {
  return ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).reduce((t, a) => t + a.coins, 0);
}
