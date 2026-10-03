import { describe, expect, it } from 'vitest';
import { GIANT } from './bosses-volcano';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
function quiet(): World {
  const w = createWorld('dog', 1, VIEW, {}, 'volcano');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], eruptions: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.invuln = 9999;
  return w;
}

describe('溶岩の巨人', () => {
  it('地ならしと岩投げを交互に使い、当たったところに溶岩の池を残す', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, 60, 0, ENEMIES.lavaGiant.hp));
    const radii = new Set<number>();
    let pools = 0;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      for (const h of w.hazards) if (h.alive && h.kind === 'slam') radii.add(h.r);
      pools = Math.max(pools, w.lava.filter((l) => l.life > 0 && l.warn <= 0).length);
    }
    expect(radii).toContain(GIANT.slamR);
    expect(radii).toContain(GIANT.rockR);
    expect(pools).toBeGreaterThan(1);
    expect(w.lava.some((l) => l.r === GIANT.slamLava)).toBe(true);
  });

  it('地ならしの予告のあいだに巨人が倒れたら、池は残らない', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, 60, 0, ENEMIES.lavaGiant.hp));
    for (let i = 0; i < 60 * 3; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      if (w.hazards.some((h) => h.alive && h.kind === 'slam')) break;
    }
    w.enemies[w.enemies.length - 1].alive = false;
    for (let i = 0; i < 60 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.lava.filter((l) => l.life > 0)).toHaveLength(0);
  });
});
