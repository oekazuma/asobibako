import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion } from '../mansion/layout';
import type { Level } from '../move';
import { NODES } from './paths';
import { Walker } from './walker';

const lv = levelOf(mansion());
const DT = 1 / 30;
const flat = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** 道が尽きるまで歩かせ、掛かった秒を返す */
function run(w: Walker, secs: number, level: Level = lv): number {
  let t = 0;
  for (; t < secs && w.path.length; t += DT) w.step(level, DT);
  return t;
}

describe('Walker', () => {
  it('網の上の最短の道で、階段も上って行き先まで歩く', () => {
    const w = new Walker(NODES.entrance);
    w.go('kitchenNorth');
    run(w, 60);
    expect(flat(w.body.pos, NODES.kitchenNorth)).toBeLessThan(0.3);
    const up = new Walker(NODES.entrance);
    up.go('galleryEast');
    run(up, 30);
    expect(flat(up.body.pos, NODES.galleryEast)).toBeLessThan(0.3);
    expect(up.body.pos[1]).toBeCloseTo(3.5, 1);
  });

  it('歩くあいだは進む向きを返し、着いたら null', () => {
    const w = new Walker(NODES.hall);
    w.go('eastDoor');
    const yaw = w.step(lv, DT);
    expect(yaw).toBeCloseTo(Math.atan2(6.2, 3.8), 1);
    run(w, 10);
    expect(w.step(lv, DT)).toBeNull();
  });

  it('pace で遅く歩き、run で走る', () => {
    const time = (pace: number, fast: boolean) => {
      const w = new Walker(NODES.entrance);
      w.pace = pace;
      w.run = fast;
      w.go('corridorWest');
      return run(w, 120);
    };
    const walk = time(1, false);
    expect(time(0.6, false)).toBeGreaterThan(walk * 1.4);
    expect(time(1, true)).toBeLessThan(walk * 0.7);
  });

  it('進めない辺はひとつ前の点へ戻って選び直し、ほかに道が無ければ戻った点で止まる', () => {
    // 廊下を壁でふさぐ。キッチンへはこの廊下を通るほかに道が無い
    const shut: Level = { ...lv, boxes: [...lv.boxes, { min: [-12, 0, 3.25], max: [-11.8, 3.5, 6.75] }] };
    const w = new Walker(NODES.corridorEast);
    w.go('kitchen');
    run(w, 30, shut);
    expect(w.path).toEqual([]);
    expect(flat(w.body.pos, NODES.corridorEast)).toBeLessThan(0.3);
  });
});
