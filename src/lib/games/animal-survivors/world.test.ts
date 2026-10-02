import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { Grid } from './grid';
import { createWorld, makeEnemy, spawnPoint, step, summary } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

describe('格子', () => {
  it('near は近いセルのものだけを返す', () => {
    const g = new Grid(32);
    g.add(0, 0, 0);
    g.add(1, 40, 0);
    g.add(2, 400, 400);
    expect(g.near(0, 0, 50, []).sort()).toEqual([0, 1]);
  });
});

describe('世界', () => {
  it('自分は入力の向きに 60 × speed px/秒で動き、向きを覚える', () => {
    const w = createWorld('dog', 1, VIEW);
    step(w, { x: -1, y: 0 }, 0.5);
    expect(w.player.x).toBeCloseTo(-30);
    expect(w.player.facing).toBe(-1);
  });

  it('序盤は出現表どおりにネズミが出る', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = []; // 武器で倒さないように
    for (let i = 0; i < 300; i++) step(w, still, 1 / 30); // 10 秒
    const alive = w.enemies.filter((e) => e.alive);
    expect(alive.length).toBeGreaterThanOrEqual(7);
    expect(new Set(alive.map((e) => e.def.id))).toEqual(new Set(['rat']));
  });

  it('同じ種なら同じ展開になる', () => {
    const run = () => {
      const w = createWorld('wolf', 7, VIEW);
      for (let i = 0; i < 900; i++) step(w, { x: Math.sin(i / 50), y: Math.cos(i / 70) }, 1 / 30);
      return [w.kills, w.player.hp, w.enemies.filter((e) => e.alive).length];
    };
    expect(run()).toEqual(run());
  });

  it('敵に触れると HP が減り、しばらく無敵になる', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [];
    w.enemies.push(makeEnemy(ENEMIES.rat, 3, 0, 6));
    step(w, still, 1 / 60);
    expect(w.player.hp).toBe(95);
    step(w, still, 1 / 60);
    expect(w.player.hp).toBe(95);
  });

  it('回し直す位置はいつも画面の外', () => {
    const w = createWorld('dog', 3, VIEW);
    w.player.x = 1000;
    w.player.moving = true;
    w.player.aimX = 1;
    for (let i = 0; i < 500; i++) {
      const p = spawnPoint(w);
      const inside = Math.abs(p.x - w.player.x) < VIEW.w / 2 && Math.abs(p.y - w.player.y) < VIEW.h / 2;
      expect(inside).toBe(false);
    }
  });

  it('900 秒でクリアになり、HP 0 でゲームオーバーになる', () => {
    const a = createWorld('dog', 1, VIEW);
    a.time = 899.99;
    step(a, still, 0.02);
    expect(a.over).toBe('clear');
    const b = createWorld('dog', 1, VIEW);
    b.player.hp = 1;
    b.weapons = [];
    b.enemies.push(makeEnemy(ENEMIES.rat, 0, 0, 6));
    step(b, still, 1 / 60);
    expect(b.over).toBe('dead');
    expect(b.events.map((e) => e.type)).toContain('dead');
  });

  it('summary はリザルトに要るものを World から写す', () => {
    const w = createWorld('cat', 1, VIEW);
    w.time = 763.4;
    w.kills = 2384;
    w.level = 18;
    w.xpTotal = 12450;
    w.over = 'dead';
    expect(summary(w)).toEqual({
      animal: 'cat',
      cleared: false,
      time: 763.4,
      level: 18,
      kills: 2384,
      xp: 12450,
      weapons: [{ id: 'paw', level: 1 }],
      passives: []
    });
  });
});
