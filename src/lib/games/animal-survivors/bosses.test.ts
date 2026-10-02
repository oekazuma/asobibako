import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, MAX_ENEMIES, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ふつうの出現を止め、武器も外した世界 */
function quiet(id: 'dog' | 'wolf' = 'dog'): World {
  const w = createWorld(id, 4, VIEW);
  w.weapons = [];
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

const run = (w: World, seconds: number, input = still) => {
  const events: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, input, 1 / 60);
    for (const e of w.events) events.push(e.type);
  }
  return events;
};

describe('ボスの出かた', () => {
  it('5 分の 3 秒前に予告が出て、5 分に巨大ベアが画面の外に出る', () => {
    const w = quiet();
    w.time = 296;
    expect(run(w, 1.5)).toContain('warning');
    expect(w.enemies.some((e) => e.alive && e.def.boss)).toBe(false);
    run(w, 2.6);
    const bear = w.enemies.find((e) => e.alive && e.def.boss === 'bear')!;
    expect(bear).toBeDefined();
    expect(bear.hp).toBe(2400);
  });

  it('10 分には女王グモが出る（倒していない巨大ベアは残る）', () => {
    const w = quiet();
    w.time = 296;
    run(w, 5);
    w.time = 598;
    run(w, 3);
    const bosses = w.enemies.filter((e) => e.alive && e.def.boss).map((e) => e.def.boss);
    expect(bosses.sort()).toEqual(['bear', 'spiderQueen']);
  });

  it('敵の枠が埋まっていてもボスは出る', () => {
    const w = quiet();
    for (let i = 0; i < MAX_ENEMIES; i++) w.enemies.push(makeEnemy({ ...ENEMIES.rat, speed: 0 }, 2000 + i, 0, 6));
    w.time = 299.99;
    run(w, 0.1);
    expect(w.enemies).toHaveLength(MAX_ENEMIES);
    expect(w.enemies.some((e) => e.alive && e.def.boss === 'bear')).toBe(true);
  });

  it('ボスは押し合いで押されない', () => {
    const w = quiet();
    const bear = makeEnemy({ ...ENEMIES.bear, speed: 0 }, 100, 0, 2400);
    w.enemies.push(bear, makeEnemy({ ...ENEMIES.rat, speed: 0 }, 105, 0, 6));
    w.time = 10;
    run(w, 0.2);
    expect(bear.x).toBeCloseTo(100, 0);
    expect(Math.hypot(w.enemies[1].x - 100, w.enemies[1].y)).toBeGreaterThan(15);
  });
});
