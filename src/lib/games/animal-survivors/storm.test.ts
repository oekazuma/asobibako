import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { STORM_PUSH, STORM_WARN, STORM_WIND } from './storm';
import { BASE_SPEED, createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

function snow(): World {
  const w = createWorld('dog', 3, VIEW, {}, 'snow');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], storms: [{ at: 10, len: 20 }] };
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.invuln = 1e9;
  return w;
}

const run = (w: World, seconds: number) => {
  const texts: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, still, 1 / 60);
    for (const e of w.events) if (e.type === 'swarm') texts.push(e.text);
  }
  return texts;
};

describe('吹雪', () => {
  it('3 秒前に帯を出し、時刻に始まって 20 秒で止む', () => {
    const w = snow();
    expect(run(w, 10 - STORM_WARN - 0.1)).toEqual([]);
    expect(run(w, 0.2)).toEqual(['吹雪が来る！']);
    expect(w.storm.left).toBe(0);
    run(w, 3);
    expect(w.storm.left).toBeGreaterThan(19);
    expect(Math.hypot(w.storm.wx, w.storm.wy)).toBeCloseTo(1);
    run(w, 19);
    expect(w.storm.left).toBeGreaterThan(0);
    run(w, 1.5);
    expect(w.storm.left).toBe(0);
  });

  it('吹雪のあいだ、止まっていても風下へふつうの速さの 2 割で流される', () => {
    const w = snow();
    run(w, 11);
    const { x, y } = w.player;
    run(w, 1);
    const dx = w.player.x - x;
    const dy = w.player.y - y;
    expect(Math.hypot(dx, dy)).toBeCloseTo(BASE_SPEED * STORM_PUSH, 0);
    expect((dx * w.storm.wx + dy * w.storm.wy) / Math.hypot(dx, dy)).toBeCloseTo(1);
  });

  it('風下へ進む敵は速く、風上へ進む敵は遅い。ボス・ランタン・群れは変わらない', () => {
    const w = snow();
    run(w, 11);
    const { wx, wy } = w.storm;
    const p = w.player;
    // 自分の風上に置いた敵は風下へ（自分のほうへ）進み、風下に置いた敵は風上へ進む
    w.enemies[0] = makeEnemy({ ...ENEMIES.penguin, heavy: 1 }, p.x - wx * 100, p.y - wy * 100, 99);
    w.enemies[1] = makeEnemy({ ...ENEMIES.penguin, heavy: 1 }, p.x + wx * 100, p.y + wy * 100, 99);
    w.enemies[2] = makeEnemy(ENEMIES.lantern, p.x + 50, p.y, 1);
    const drift = makeEnemy(ENEMIES.snowsprite, p.x - 150, p.y, 9);
    Object.assign(drift, { dx: 1, dy: 0, drift: 5 });
    w.enemies[3] = drift;
    const before = w.enemies.map((e) => ({ x: e.x, y: e.y }));
    const px = p.x;
    const py = p.y;
    step(w, still, 1 / 60);
    const moved = (i: number) => Math.hypot(w.enemies[i].x - before[i].x, w.enemies[i].y - before[i].y) * 60;
    // 自分も風で動くので、その分は置いた位置どうしの差で消える
    expect(px !== p.x || py !== p.y).toBe(true);
    expect(moved(0)).toBeCloseTo(ENEMIES.penguin.speed * (1 + STORM_WIND), 0);
    expect(moved(1)).toBeCloseTo(ENEMIES.penguin.speed * (1 - STORM_WIND), 0);
    expect(moved(2)).toBe(0);
    expect(moved(3)).toBeCloseTo(ENEMIES.snowsprite.speed * 1.5, 0);
  });

  it('3 択・宝箱のあいだは吹雪の残りが減らず、時計のあいだは流されない', () => {
    const w = snow();
    run(w, 12);
    const left = w.storm.left;
    w.pending = 1;
    run(w, 5);
    w.pending = 0;
    w.chests = 1;
    run(w, 5);
    w.chests = 0;
    expect(w.storm.left).toBe(left);
    w.freeze = 5;
    const { x, y } = w.player;
    run(w, 1);
    expect([w.player.x, w.player.y]).toEqual([x, y]);
  });

  it('森と墓地は吹雪が来ない', () => {
    for (const id of ['forest', 'graveyard']) {
      const w = createWorld('dog', 3, VIEW, {}, id);
      w.time = 899;
      expect(w.stage.storms).toEqual([]);
      expect(w.storm.left).toBe(0);
    }
  });
});
