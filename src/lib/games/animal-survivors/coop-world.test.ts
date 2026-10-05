import { describe, expect, it } from 'vitest';
import { SLOTS } from './choices';
import { ENEMIES } from './enemies';
import { HERO_SLOTS } from './heroes';
import { addHero, createWorld, hurtPlayer, makeEnemy, step } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

function two() {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'dog');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.heroes[0].player.x = 0;
  w.heroes[1].player.x = 200;
  for (const h of w.heroes) h.stats.crit = 0;
  return w;
}

describe('2 匹の World', () => {
  it('武器の枠の数は 3 択の枠と同じ', () => {
    expect(HERO_SLOTS).toBe(SLOTS);
  });

  it('敵は近いほうの動物を追い、step のあとは cur が 0 に戻る', () => {
    const w = two();
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 170, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.enemies[0].x).toBeGreaterThan(170);
    expect(w.cur).toBe(0);
  });

  it('2 匹が当たりの時計を使う同じ武器（骨ブーメラン・ツタ）を持っても、同じ敵にそれぞれ当たる', () => {
    for (const id of ['boomerang', 'vine']) {
      const w = two();
      w.heroes[1].player.x = 20;
      for (const h of w.heroes) h.weapons = [{ id, level: 1, cd: 0 }];
      w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, 10, 40, 100000));
      for (let i = 0; i < 180; i++) step(w, still, 1 / 60);
      expect(w.heroes[0].dealt[id]?.damage ?? 0).toBeGreaterThan(0);
      expect(w.heroes[1].dealt[id]?.damage ?? 0).toBeGreaterThan(0);
    }
  });

  it('2 匹が同じ武器でも、同じ敵にそれぞれ当たる', () => {
    const w = two();
    w.heroes[1].player.x = 20;
    w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, 10, 40, 1000));
    for (let i = 0; i < 60; i++) step(w, still, 1 / 60);
    expect(Object.keys(w.heroes[0].dealt)).not.toHaveLength(0);
    expect(Object.keys(w.heroes[1].dealt)).not.toHaveLength(0);
    expect(w.cur).toBe(0);
  });

  it('経験値は共通で、レベルが上がると 2 匹ともに 3 択が 1 つたまる', () => {
    const w = two();
    w.gems.push({ alive: true, x: 0, y: 0, value: 999, pulled: true });
    step(w, still, 1 / 60);
    expect(w.level).toBeGreaterThan(1);
    expect(w.heroes[0].pending).toBeGreaterThan(0);
    expect(w.heroes[1].pending).toBe(w.heroes[0].pending);
  });

  it('子の 3 択が残っていると止まる', () => {
    const w = two();
    w.heroes[1].pending = 1;
    step(w, still, 1 / 60);
    expect(w.time).toBe(0);
  });

  it('1 匹が倒れても続き、倒れた子は撃たず追われず、2 匹とも倒れたら終わる', () => {
    const w = two();
    w.cur = 1;
    w.heroes[1].revives = 0;
    w.heroes[1].rebirths = 0;
    hurtPlayer(w, 99999);
    w.cur = 0;
    expect(w.heroes[1].down).toBe(true);
    expect(w.over).toBeNull();
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 190, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.enemies[0].x).toBeLessThan(190);
    expect(w.shots.filter((s) => s.alive && s.slot >= HERO_SLOTS)).toHaveLength(0);
    w.heroes[0].revives = 0;
    w.heroes[0].rebirths = 0;
    hurtPlayer(w, 99999);
    expect(w.over).toBe('dead');
  });

  it('拾った動物の宝箱になり、どちらかに宝箱が残っていれば止まる', () => {
    const w = two();
    w.items.push({ alive: true, kind: 'chest', x: 200, y: 0, pulled: false });
    step(w, still, 1 / 60);
    expect(w.heroes[1].chests).toBe(1);
    expect(w.heroes[0].chests).toBe(0);
    const t = w.time;
    step(w, still, 1 / 60);
    expect(w.time).toBe(t);
  });

  it('倒れた動物のそばに 3 秒いると HP 半分で起き上がり、離れると時計が戻る', () => {
    const w = two();
    w.heroes[1].down = true;
    w.heroes[1].player.hp = 0;
    w.heroes[0].player.x = 190;
    for (let i = 0; i < 120; i++) step(w, still, 1 / 60);
    expect(w.heroes[1].down).toBe(true);
    w.heroes[0].player.x = 0;
    step(w, still, 1 / 60);
    expect(w.heroes[1].revive).toBe(0);
    w.heroes[0].player.x = 190;
    for (let i = 0; i < 185; i++) step(w, still, 1 / 60);
    expect(w.heroes[1].down).toBe(false);
    expect(w.heroes[1].player.hp).toBe(Math.round(w.heroes[1].stats.maxHp / 2));
  });

  it('起こす側も倒れていれば、起こす時計は進まない', () => {
    const w = two();
    w.heroes[1].down = true;
    w.heroes[0].down = true;
    w.heroes[0].player.x = 190;
    for (let i = 0; i < 200; i++) step(w, still, 1 / 60);
    expect(w.heroes[1].revive).toBe(0);
    expect(w.heroes[1].down).toBe(true);
  });
});
