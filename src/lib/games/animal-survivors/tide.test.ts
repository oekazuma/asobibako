import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import {
  addShallow,
  MAX_SHALLOWS,
  SHALLOW_GROW,
  SHALLOW_LIFE,
  stepTide,
  updateShallows,
  WADE,
  wadeFactor
} from './tide';
import { createWorld, damageEnemy, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'coast');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};

describe('満ち潮', () => {
  it('3 秒前に帯を出し、満ち潮のあいだ自分のまわりに浅瀬を足す', () => {
    const w = quiet();
    w.time = 91;
    let warned = false;
    for (let i = 0; i < 30 * 5; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      warned ||= w.events.some((e) => e.type === 'swarm' && e.text === '潮が満ちてくる！');
    }
    expect(warned).toBe(true);
    for (let i = 0; i < 30 * 5; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.shallows.length).toBeGreaterThan(2);
    for (const s of w.shallows) expect(Math.hypot(s.x - w.player.x, s.y - w.player.y)).toBeLessThan(140);
  });

  it('浅瀬はにじむあいだは遅くせず、そのあと 8 秒で消える', () => {
    const w = quiet();
    addShallow(w, 0, 0, 30);
    expect(wadeFactor(w, 0, 0)).toBe(1);
    updateShallows(w, SHALLOW_GROW + 0.01);
    expect(wadeFactor(w, 0, 0)).toBe(WADE);
    updateShallows(w, SHALLOW_LIFE + 0.1);
    expect(wadeFactor(w, 0, 0)).toBe(1);
  });

  it('重なった浅瀬でも遅さは 5 割のままで、渦巻き貝を持つと 7.5 割', () => {
    const w = quiet();
    addShallow(w, 0, 0, 30, { grow: 0 });
    addShallow(w, 5, 0, 30, { grow: 0 });
    expect(wadeFactor(w, 0, 0)).toBe(WADE);
    w.relics.push('conch');
    expect(wadeFactor(w, 0, 0)).toBe(0.75);
  });

  it('浅瀬の中の自分は遅くなり、敵は遅くならない', () => {
    const w = quiet();
    addShallow(w, 0, 0, 200, { grow: 0 });
    const x = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 30);
    const inWater = w.player.x - x;
    w.shallows.length = 0;
    const x2 = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 30);
    expect(inWater).toBeCloseTo((w.player.x - x2) * WADE, 3);
  });

  it('浅瀬の中の敵は、外の敵と同じ速さで進む', () => {
    const w = quiet();
    const e = makeEnemy(ENEMIES.crab, 80, 0, 999);
    w.enemies.push(e);
    addShallow(w, 80, 0, 200, { grow: 0 });
    step(w, { x: 0, y: 0 }, 1 / 30);
    const inWater = 80 - e.x;
    w.shallows.length = 0;
    e.x = 80;
    e.y = 0;
    step(w, { x: 0, y: 0 }, 1 / 30);
    expect(inWater).toBeGreaterThan(0);
    expect(inWater).toBeCloseTo(80 - e.x, 6);
  });

  it('時計の品で止まっているあいだは、満ち潮の時計も浅瀬の残りも進まない', () => {
    const w = quiet();
    w.freeze = 5;
    addShallow(w, 0, 0, 30);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.shallows[0].grow).toBeGreaterThan(0);
  });

  it('浅瀬は上限までで、あふれたら残りの短いものを置き換える', () => {
    const w = quiet();
    for (let i = 0; i < MAX_SHALLOWS + 5; i++) addShallow(w, i * 10, 0, 10, { grow: 0 });
    expect(w.shallows.length).toBe(MAX_SHALLOWS);
  });

  it('満ち潮の時計は step の中で進むので、step を呼ばなければ減らない', () => {
    const w = quiet();
    w.time = 95;
    stepTide(w, 1 / 30);
    const left = w.tide.left;
    expect(left).toBeGreaterThan(0);
    expect(w.tide.left).toBe(left);
  });

  it('満ち潮のあいだに倒した敵だけを数える', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.crab, 5, 0, 1), makeEnemy(ENEMIES.crab, 9, 0, 1));
    damageEnemy(w, 0, 5, 0, 0);
    expect(w.tideKills).toBe(0);
    w.tide.left = 5;
    damageEnemy(w, 1, 5, 0, 0);
    expect(w.tideKills).toBe(1);
  });
});
