import { describe, expect, it } from 'vitest';
import { addLava, CRACK_WARN, MAX_LAVA, POOL_LIFE, POOL_TICK, stepEruption, updateLava } from './eruption';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'volcano');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};

describe('噴火', () => {
  it('3 秒前に帯を出し、噴火のあいだ自分のまわりに割れ目を置く', () => {
    const w = quiet();
    w.time = 91;
    let saw = false;
    for (let i = 0; i < 30 * 5; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      saw ||= w.events.some((e) => e.type === 'swarm' && e.text === '噴火が来る！');
    }
    expect(saw).toBe(true);
    for (let i = 0; i < 30 * 5; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.lava.length).toBeGreaterThan(2);
    for (const l of w.lava) expect(Math.hypot(l.x - w.player.x, l.y - w.player.y)).toBeLessThan(140);
  });

  it('割れ目は 1.2 秒で池になり、池は 6 秒で消える', () => {
    const w = quiet();
    addLava(w, 200, 200, 20);
    updateLava(w, CRACK_WARN - 0.01);
    expect(w.lava[0].warn).toBeGreaterThan(0);
    updateLava(w, 0.02);
    expect(w.lava[0].warn).toBeLessThanOrEqual(0);
    updateLava(w, POOL_LIFE + 0.1);
    expect(w.lava.filter((l) => l.life > 0)).toHaveLength(0);
  });

  it('池は中の自分と敵に当たり、ボス・ランタン・大ヘビの節には当てない', () => {
    const w = quiet();
    w.player.invuln = 0;
    addLava(w, 0, 0, 30, 0);
    w.enemies.push(makeEnemy(ENEMIES.lizard, 5, 0, 1));
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, -5, 0, 999));
    w.enemies.push(makeEnemy(ENEMIES.lantern, 0, 5, 1));
    w.enemies.push(makeEnemy(ENEMIES.snakeSeg, 0, -5, 999));
    const hp = w.player.hp;
    updateLava(w, POOL_TICK + 0.01);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.lavaKills).toBe(1);
    expect(w.enemies[1].hp).toBe(999);
    expect(w.enemies[2].alive).toBe(true);
    expect(w.enemies[3].hp).toBe(999);
  });

  it('時計の品で止まっているあいだは当たらず、割れ目も噴かない', () => {
    const w = quiet();
    w.freeze = 5;
    addLava(w, 0, 0, 30);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.lava[0].warn).toBeGreaterThan(0);
  });

  it('池は上限までで、あふれたら残りの短い池を置き換える', () => {
    const w = quiet();
    for (let i = 0; i < MAX_LAVA + 5; i++) addLava(w, i * 10, 0, 10, 0);
    expect(w.lava.length).toBe(MAX_LAVA);
  });

  it('噴火の時計は step の中で進むので、step を呼ばなければ減らない', () => {
    const w = quiet();
    w.time = 95;
    stepEruption(w, 1 / 30);
    const left = w.eruption.left;
    expect(left).toBeGreaterThan(0);
    expect(w.eruption.left).toBe(left);
  });
});
