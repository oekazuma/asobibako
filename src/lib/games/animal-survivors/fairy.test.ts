import { describe, expect, it } from 'vitest';
import { CHARGE, CHARGE_DUST, RING_FAR, RING_NEAR, RING_LIFE, chargeTime, holdInRing, stepFairy } from './fairy';
import { ENEMIES } from './enemies';
import { obstaclesNear } from './obstacles';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'grove');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof quiet>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};
const appear = (w: ReturnType<typeof quiet>) => {
  w.time = 95;
  stepFairy(w, 0);
  return w.fairy.ring!;
};

describe('妖精の輪', () => {
  it('時刻に帯を出し、動物から 60〜120 ドット先の障害物の無い場所に置き、20 秒で消える', () => {
    const w = quiet();
    w.time = 94.9;
    let shown = false;
    for (let i = 0; i < 10; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      shown ||= w.events.some((e) => e.type === 'swarm' && e.text === '妖精の輪が現れた！');
    }
    expect(shown).toBe(true);
    const ring = w.fairy.ring!;
    const d = Math.hypot(ring.x - w.player.x, ring.y - w.player.y);
    expect(d).toBeGreaterThanOrEqual(RING_NEAR);
    expect(d).toBeLessThanOrEqual(RING_FAR);
    expect(obstaclesNear(w.stage.art, ring.x, ring.y, ring.r, []).length).toBe(0);
    run(w, RING_LIFE + 0.5);
    expect(w.fairy.ring).toBeNull();
  });

  it('入るとためはじめ、3 秒で満ちてふつうの敵が倒れ、ヌシとボスは 1 割、ランタンは残る', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    const grunt = makeEnemy(ENEMIES.shroomling, ring.x + 60, ring.y, 1e6);
    const boss = makeEnemy(ENEMIES.stag, ring.x - 80, ring.y, 1000);
    const lantern = makeEnemy(ENEMIES.lantern, ring.x, ring.y + 70, 1);
    w.enemies.push(grunt, boss, lantern);
    run(w, CHARGE - 0.2);
    expect(grunt.alive).toBe(true);
    run(w, 0.4);
    expect(grunt.alive).toBe(false);
    expect(boss.hp).toBeCloseTo(900, 0);
    expect(lantern.alive).toBe(true);
    expect(w.fairy.ring).toBeNull();
    expect(w.fairyKills).toBe(1);
  });

  it('ためているあいだは輪の外へ出られず、満ちたら出られる', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    for (let i = 0; i < 30 * 2; i++) step(w, { x: 1, y: 0 }, 1 / 30);
    expect(Math.hypot(w.player.x - ring.x, w.player.y - ring.y)).toBeLessThanOrEqual(ring.r);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 1, y: 0 }, 1 / 30);
    expect(Math.hypot(w.player.x - ring.x, w.player.y - ring.y)).toBeGreaterThan(ring.r);
  });

  it('時計の品で止まっているあいだは、輪の時計もためる時計も進まない', () => {
    const w = quiet();
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    run(w, 1);
    const { left, charge } = w.fairy;
    w.freeze = 5;
    run(w, 2);
    expect(w.fairy.left).toBe(left);
    expect(w.fairy.charge).toBe(charge);
  });

  it('妖精の粉で 2 秒、月のしずくで満ちたとき HP が 3 割戻る', () => {
    const w = quiet();
    expect(chargeTime(w)).toBe(CHARGE);
    w.relics.push('dust', 'moon');
    expect(chargeTime(w)).toBe(CHARGE_DUST);
    const ring = appear(w);
    w.player.x = ring.x;
    w.player.y = ring.y;
    w.player.hp = 10;
    run(w, CHARGE_DUST + 0.2);
    expect(w.player.hp).toBeGreaterThanOrEqual(10 + Math.floor(w.stats.maxHp * 0.3) - 1);
  });

  it('ためていないときは holdInRing は何もしない', () => {
    const w = quiet();
    const ring = appear(w);
    const p = { x: ring.x + 200, y: ring.y };
    holdInRing(w, p);
    expect(p.x).toBe(ring.x + 200);
  });
});
