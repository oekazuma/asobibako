import { describe, expect, it } from 'vitest';
import { capsuleAt, machine, slotOf, TIER } from './gacha3d';
import { DROP, makeShow, OPEN_TIME, SPIN, tick, TURN, turn } from './gacha-show';

describe('ガチャの機械', () => {
  it('台・ガラスの球・ハンドルと、10 こ分のカプセルがある', () => {
    const m = machine();
    expect(m.group.getObjectByName('base')).toBeTruthy();
    expect(m.group.getObjectByName('dome')).toBeTruthy();
    expect(m.group.getObjectByName('handle')).toBe(m.handle);
    expect(m.capsules).toHaveLength(10);
    expect(m.capsules[0].group.children).toContain(m.capsules[0].top);
  });

  it('カプセルは転がるあいだに取り出し口へ進み、待つときは止まり、割れると上下が離れる', () => {
    const s = makeShow(['owl:1']);
    const start = capsuleAt(s, 0);
    turn(s, TURN);
    for (let t = 0; t < SPIN + DROP * 0.5; t += 1 / 60) tick(s, 1 / 60);
    const mid = capsuleAt(s, 0);
    for (let t = 0; t < DROP; t += 1 / 60) tick(s, 1 / 60);
    const end = capsuleAt(s, 0);
    expect(mid.y).toBeLessThan(start.y);
    expect(end.y).toBeLessThanOrEqual(mid.y);
    expect(end.open).toBe(0);
    s.phase = 'open';
    s.t = OPEN_TIME[1];
    expect(capsuleAt(s, 0).open).toBeCloseTo(1);
  });

  it('10 この置き場所は重ならず、2 段に並ぶ', () => {
    const slots = Array.from({ length: 10 }, (_, i) => slotOf(i, 10));
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++) expect(slots[i].distanceTo(slots[j])).toBeGreaterThan(0.25);
    expect(new Set(slots.map((v) => v.y.toFixed(2))).size).toBe(2);
  });

  it('割れ方はレア度が高いほど豪華になる', () => {
    for (const k of ['beam', 'width', 'rays', 'dim', 'sparks'] as const) {
      expect(TIER[1][k]).toBeGreaterThanOrEqual(TIER[0][k]);
      expect(TIER[2][k]).toBeGreaterThan(TIER[1][k]);
    }
  });

  it('10 連のカプセルは順に遅れて転がり出る', () => {
    const s = makeShow(Array.from({ length: 10 }, () => 'owl:0' as const));
    turn(s, TURN);
    for (let t = 0; t < SPIN + DROP * 0.5; t += 1 / 60) tick(s, 1 / 60);
    expect(capsuleAt(s, 0).z).toBeGreaterThan(capsuleAt(s, 9).z);
  });
});
