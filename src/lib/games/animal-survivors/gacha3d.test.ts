import { describe, expect, it } from 'vitest';
import { capsuleAt, machine } from './gacha3d';
import { DROP, makeShow, SPIN, tick, TURN, turn } from './gacha-show';

describe('ガチャの機械', () => {
  it('台・ガラスの球・ハンドル・カプセルがある', () => {
    const m = machine();
    expect(m.group.getObjectByName('base')).toBeTruthy();
    expect(m.group.getObjectByName('dome')).toBeTruthy();
    expect(m.group.getObjectByName('handle')).toBe(m.handle);
    expect(m.capsule.children).toContain(m.top);
    expect(m.capsule.children).toContain(m.bottom);
  });

  it('カプセルは転がるあいだに取り出し口へ進み、待つときは止まり、割れると上下が離れる', () => {
    const s = makeShow('owl:2');
    const start = capsuleAt(s);
    turn(s, TURN);
    for (let t = 0; t < SPIN + DROP * 0.5; t += 1 / 60) tick(s, 1 / 60);
    const mid = capsuleAt(s);
    for (let t = 0; t < DROP; t += 1 / 60) tick(s, 1 / 60);
    const end = capsuleAt(s);
    expect(mid.y).toBeLessThan(start.y);
    expect(end.y).toBeLessThanOrEqual(mid.y);
    expect(end.open).toBe(0);
    s.phase = 'open';
    s.t = 0.6;
    expect(capsuleAt(s).open).toBeCloseTo(1);
  });
});
