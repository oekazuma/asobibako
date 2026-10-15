import { describe, expect, it } from 'vitest';
import { BLACKOUT_WARN, FADE, HERO_LIGHT, lightRadius, stepBlackout } from './blackout';
import { ENEMIES } from './enemies';
import { createWorld, damageEnemy, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'city');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof quiet>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};

describe('停電', () => {
  it('3 秒前に帯を出し、1 秒で暗くなり、20 秒のあと 1 秒で戻る', () => {
    const w = quiet();
    w.time = 95 - BLACKOUT_WARN - 1;
    let warned = false;
    for (let i = 0; i < 30 * 2; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      warned ||= w.events.some((e) => e.type === 'swarm' && e.text === '停電だ！');
    }
    expect(warned).toBe(true);
    run(w, BLACKOUT_WARN - 1 + FADE + 0.1);
    expect(w.blackout.left).toBeGreaterThan(0);
    expect(w.blackout.dark).toBe(1);
    run(w, 20);
    expect(w.blackout.left).toBe(0);
    run(w, FADE + 0.1);
    expect(w.blackout.dark).toBe(0);
  });

  it('時計の品で止まっているあいだは、停電の時計も暗さも進まない', () => {
    const w = quiet();
    w.time = 100;
    stepBlackout(w, 0);
    run(w, 2);
    const { left, dark, next } = w.blackout;
    w.freeze = 5;
    run(w, 2);
    expect(w.blackout.left).toBe(left);
    expect(w.blackout.dark).toBe(dark);
    expect(w.blackout.next).toBe(next);
  });

  it('停電の途中から始まる回は、最初の step で残りの秒になる', () => {
    const w = quiet();
    w.time = 100;
    stepBlackout(w, 0);
    expect(w.blackout.left).toBeCloseTo(15, 5);
  });

  it('懐中電灯を持つと明るい輪が 1.5 倍', () => {
    const w = quiet();
    expect(lightRadius(w)).toBe(HERO_LIGHT);
    w.relics.push('torch');
    expect(lightRadius(w)).toBe(HERO_LIGHT * 1.5);
  });

  it('停電のあいだに倒した敵を数える', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.crab, 5, 0, 1), makeEnemy(ENEMIES.crab, 9, 0, 1));
    damageEnemy(w, 0, 5, 0, 0);
    expect(w.blackoutKills).toBe(0);
    w.time = 100;
    stepBlackout(w, 0);
    expect(w.blackout.left).toBeGreaterThan(0);
    damageEnemy(w, 1, 5, 0, 0);
    expect(w.blackoutKills).toBe(1);
  });
});
