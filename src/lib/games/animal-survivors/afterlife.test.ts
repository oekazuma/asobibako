import { describe, expect, it } from 'vitest';
import { addLava, updateLava } from './eruption';
import { ENEMIES } from './enemies';
import { weaponStats, WEAPONS } from './weapons';
import { flameAt, updateZones } from './zones';
import { addEnemy, createWorld, step } from './world';

const VIEW = { w: 274, h: 394 };
const mob = () => ENEMIES.lizard ?? Object.values(ENEMIES).find((d) => !d.boss && !d.prop && !d.metal && !d.part)!;

describe('倒れたあとの溶岩', () => {
  it('池で自分が倒れたら、同じ池でも敵には当てない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'volcano');
    w.stats.armor = 0;
    w.player.hp = 1;
    const e = addEnemy(w, mob(), 2, 0)!;
    e.hp = 1;
    addLava(w, 0, 0, 20, 0);
    updateLava(w, 0.016);
    expect(w.over).toBe('dead');
    expect(e.alive).toBe(true);
    expect(w.lavaKills).toBe(0);
  });

  it('体当たりで倒れたフレームは、溶岩の池を回さない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'volcano');
    w.stats.armor = 0;
    w.player.hp = 1;
    w.time = 30;
    addEnemy(w, mob(), 0, 0);
    const far = addEnemy(w, mob(), 60, 0)!;
    far.hp = 1;
    addLava(w, 60, 0, 20, 0);
    step(w, { x: 0, y: 0 }, 0.016);
    expect(w.over).toBe('dead');
    expect(far.alive).toBe(true);
  });
});

describe('火の羽根と炎の当たりの時計', () => {
  it('羽根が当たった直後でも、羽根の炎は当たる', () => {
    const w = createWorld('chick', 1, VIEW);
    const e = addEnemy(w, mob(), 40, 0)!;
    e.hp = 1000;
    const i = w.enemies.indexOf(e);
    e.hit[0] = w.time;
    flameAt(w, 0, e.x, e.y, 1, { ...weaponStats(WEAPONS.fireFeather, 1), damage: 10, duration: 1 });
    w.grid.clear();
    w.grid.add(i, e.x, e.y);
    updateZones(w);
    expect(e.hp).toBeLessThan(1000);
    // 炎が当たっても、羽根の時計は動かない
    expect(e.hit[0]).toBe(w.time);
  });
});
