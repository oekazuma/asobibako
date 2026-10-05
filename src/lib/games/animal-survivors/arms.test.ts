import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

function only(weapon: string, level = 1) {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = [{ id: weapon, level, cd: 0 }];
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.stats.crit = 0;
  return w;
}

const run = (w: ReturnType<typeof only>, seconds: number) => {
  for (let i = 0; i < seconds * 60; i++) step(w, still, 1 / 60);
};

describe('武器', () => {
  it('ワンワンショットは近い敵へ飛んで当たる', () => {
    const w = only('woof');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 100));
    run(w, 0.6);
    expect(w.enemies[0].hp).toBe(90);
  });

  it('Lv3 は 2 発になる', () => {
    const w = only('woof', 3);
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.shots.filter((s) => s.alive)).toHaveLength(2);
  });

  it('ネコパンチは向いている側だけを引っかく', () => {
    const w = only('paw');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 15, 0, 100), makeEnemy(ENEMIES.caterpillar, -15, 0, 100));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(90);
    expect(w.enemies[1].hp).toBe(100);
  });

  it('ネコパンチは背中側にしか敵がいなければ、そちらへ振り向いて引っかく', () => {
    const w = only('paw');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, -15, 0, 100));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(90);
  });

  it('骨ブーメランは近い敵のほうへ投げる', () => {
    const w = only('boomerang');
    w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0 }, 0, 60, 100));
    step(w, still, 1 / 60);
    const b = w.shots.find((o) => o.alive)!;
    expect(b.vy).toBeGreaterThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(1);
  });

  it('遠吠えの輪は 1 回の輪で同じ敵に 1 度だけ当たる', () => {
    const w = only('howl');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1000));
    w.enemies[0].def = { ...ENEMIES.caterpillar, speed: 0, heavy: 1 };
    run(w, 0.5);
    expect(w.enemies[0].hp).toBe(990);
  });

  it('数が増えると、遠吠えは輪を続けて出して同じ敵にその数だけ当たる', () => {
    const w = only('howl');
    w.stats.amount = 1;
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1000));
    w.enemies[0].def = { ...ENEMIES.caterpillar, speed: 0, heavy: 1 };
    run(w, 1.2);
    expect(w.enemies[0].hp).toBe(980);
  });

  it('数が増えると、野生の炎は 1 回に置く炎が増える', () => {
    const w = only('flame');
    w.stats.amount = 2;
    step(w, still, 1 / 60);
    expect(w.effects.filter((f) => f.alive && f.kind === 'flame')).toHaveLength(3);
  });

  it('羽根の嵐は同じ敵に間をあけて何度も当たる', () => {
    const w = only('feather');
    w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, 30, 0, 1000));
    run(w, 2);
    const hits = (1000 - w.enemies[0].hp) / 7;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(6);
  });

  it('雷撃は画面の中の敵にだけ落ちる', () => {
    const w = only('thunder');
    w.enemies.push(makeEnemy(ENEMIES.rat, 1000, 0, 100), makeEnemy(ENEMIES.rat, 50, 50, 100));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(100);
    expect(w.enemies[1].hp).toBe(78);
  });

  it('攻撃力と会心が掛かる', () => {
    const w = only('woof');
    w.stats.might = 1.5;
    w.stats.crit = 1;
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 60, 0, 100));
    run(w, 0.6);
    expect(w.enemies[0].hp).toBe(70);
  });
});
