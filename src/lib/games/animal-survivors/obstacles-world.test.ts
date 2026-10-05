import { describe, expect, it } from 'vitest';
import { dropGem } from './drops';
import { ENEMIES } from './enemies';
import { startEvent } from './events';
import { obstacleAt, obstaclesNear, PLAYER_R, SHAPES, type Obstacle } from './obstacles';
import { createWorld, makeEnemy, spawnPoint, step, type World } from './world';

const VIEW = { w: 260, h: 380 };

function quiet(stage = 'forest'): World {
  const w = createWorld('dog', 1, VIEW, {}, stage);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
}

function firstObstacle(w: World): Obstacle {
  for (let c = 1; ; c++) {
    const o = obstacleAt(w.stage.art, c, 0);
    if (o) return o;
  }
}

const inside = (w: World, x: number, y: number, r: number) =>
  obstaclesNear(w.stage.art, x, y, r, []).some((o) =>
    SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, y - o.y - dy) < r + cr - 0.01)
  );

describe('World の障害物', () => {
  it('自分は障害物に向かって歩いても中に入らない', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x - 60, y: o.y });
    for (let i = 0; i < 120; i++) {
      step(w, { x: 1, y: 0 }, 1 / 30);
      expect(inside(w, w.player.x, w.player.y, PLAYER_R)).toBe(false);
    }
  });

  it('吹雪で流されても中に入らない', () => {
    const w = quiet('snow');
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x - 40, y: o.y });
    Object.assign(w.storm, { left: 100, wx: 1, wy: 0, next: 99 });
    for (let i = 0; i < 300; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      expect(inside(w, w.player.x, w.player.y, PLAYER_R)).toBe(false);
    }
  });

  it('ふつうの敵は中に入らず、ボスは通り抜ける', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x + 80, y: o.y });
    const foe = makeEnemy(ENEMIES.caterpillar, o.x - 50, o.y, 1e6);
    const boss = makeEnemy(ENEMIES.bear, o.x - 50, o.y + 0.5, 1e9);
    w.enemies.push(foe, boss);
    let bossIn = false;
    for (let i = 0; i < 200; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      expect(inside(w, foe.x, foe.y, foe.def.r)).toBe(false);
      bossIn ||= inside(w, boss.x, boss.y, 1);
    }
    expect(bossIn).toBe(true);
  });

  it('群れに押されても、敵は障害物の中に残らない（押し合いのあとに押し出す）', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x + 70, y: o.y });
    for (let i = 0; i < 30; i++)
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, o.x - 40 - (i % 6) * 4, o.y + (i % 5) * 4 - 8, 1e6));
    for (let k = 0; k < 120; k++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      for (const e of w.enemies) if (e.alive) expect(inside(w, e.x, e.y, e.def.r)).toBe(false);
    }
  });

  it('敵の出る位置は障害物の中にならない', () => {
    const w = quiet();
    for (let i = 0; i < 2000; i++) {
      w.player.x = i * 37;
      w.player.y = (i % 50) * 41;
      const at = spawnPoint(w);
      expect(inside(w, at.x, at.y, 12)).toBe(false);
    }
  });

  it('障害物の中に落ちた玉は外へずれる', () => {
    const w = quiet();
    const o = firstObstacle(w);
    dropGem(w, o.x, o.y, 5);
    const g = w.gems.find((x) => x.alive)!;
    expect(inside(w, g.x, g.y, 4)).toBe(false);
  });

  it('宝の地図の宝箱は障害物の中に置かれない', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const w = createWorld('dog', seed, VIEW, {}, 'graveyard');
      startEvent(w, { at: 0, kind: 'treasure' } as never);
      expect(inside(w, w.treasure!.x, w.treasure!.y, 8)).toBe(false);
    }
  });
});
