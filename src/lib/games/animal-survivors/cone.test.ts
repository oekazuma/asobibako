import { describe, expect, it } from 'vitest';
import { fire } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { WEAPONS } from './weapons';
import { createWorld, makeEnemy, type World } from './world';

const VIEW = { w: 274, h: 394 };

function only(weapon: string): World {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = [{ id: weapon, level: 1, cd: 0 }];
  w.stage = { ...w.stage, waves: [] };
  w.stats.crit = 0;
  return w;
}

const grid = (w: World) => {
  w.grid.clear();
  w.enemies.forEach((e, i) => e.alive && w.grid.add(i, e.x, e.y));
};

describe('竜の息', () => {
  it('いちばん近い敵の向きへ扇形に吐き、扇の中の敵にだけ当たる', () => {
    const w = only('breath');
    w.enemies.push(
      makeEnemy(ENEMIES.croc, 40, -6, 999),
      makeEnemy(ENEMIES.croc, 70, 20, 999),
      makeEnemy(ENEMIES.croc, -50, -6, 999),
      makeEnemy(ENEMIES.croc, 0, -90, 999)
    );
    grid(w);
    fire(w, 1 / 60);
    expect(w.enemies.map((e) => e.hp < 999)).toEqual([true, true, false, false]);
    expect(WEAPONS.breath.kind).toBe('cone');
  });

  it('敵がいなければ向いている向きへ吐き、向きが壊れない', () => {
    const w = only('breath');
    grid(w);
    fire(w, 1 / 60);
    const fx = w.effects.find((f) => f.alive && f.kind === 'cone')!;
    expect(fx).toBeDefined();
    expect(Number.isFinite(fx.angle)).toBe(true);
  });

  it('敵が真上に重なっていても当たる', () => {
    const w = only('breath');
    w.enemies.push(makeEnemy(ENEMIES.croc, 0, -6, 999));
    grid(w);
    fire(w, 1 / 60);
    expect(w.enemies[0].hp).toBeLessThan(999);
  });
});

describe('その動物だけの武器', () => {
  it('トラの爪と竜の息はほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 5, VIEW);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const c of choices(w)) if (c.kind === 'weapon') seen.add(c.id);
    expect(seen.has('tigerClaw')).toBe(false);
    expect(seen.has('breath')).toBe(false);
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('トラの爪', () => {
  it('前と後ろの両方を裂く', () => {
    const w = only('tigerClaw');
    w.enemies.push(makeEnemy(ENEMIES.croc, 20, -6, 999), makeEnemy(ENEMIES.croc, -20, -6, 999));
    grid(w);
    fire(w, 1 / 60);
    expect(w.enemies.map((e) => e.hp < 999)).toEqual([true, true]);
  });
});
