import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ほかの敵とボスを出さず、武器を 1 つだけ持たせた世界 */
function only(weapon: string, level = 1): World {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = weapon ? [{ id: weapon, level, cd: 0 }] : [];
  w.stage = { ...w.stage, waves: [], bosses: [] };
  w.spawnAcc = [];
  w.stats.crit = 0;
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

const run = (w: World, seconds: number, input = still) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, input, 1 / 60);
};

/** 動かず吹き飛ばされない的 */
const target = (x: number, y: number) => makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, x, y, 1000);

describe('新しい武器', () => {
  it('5 つともレベル 5 までの上げ幅を持つ', () => {
    for (const id of ['claw', 'dash', 'acorn', 'flame', 'vine']) expect(WEAPONS[id].ups).toHaveLength(MAX_LEVEL - 1);
  });

  it('爪は近い敵の側を裂く', () => {
    const w = only('claw');
    w.enemies.push(target(-20, 0));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(992);
  });

  it('ダッシュは一直線に並んだ敵をまとめて貫き、同じ敵には 1 回だけ当たる', () => {
    const w = only('dash');
    w.enemies.push(target(30, 0), target(60, 0), target(90, 0));
    run(w, 0.6);
    expect(w.enemies.map((e) => e.hp)).toEqual([980, 980, 980]);
  });

  it('どんぐりは全方向に等間隔で 6 発出る', () => {
    const w = only('acorn');
    w.enemies.push(target(200, 0));
    step(w, still, 1 / 60);
    const angles = w.shots
      .filter((o) => o.alive)
      .map((o) => Math.atan2(o.vy, o.vx))
      .sort((a, b) => a - b);
    expect(angles).toHaveLength(6);
    for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(Math.PI / 3, 5);
  });
});
