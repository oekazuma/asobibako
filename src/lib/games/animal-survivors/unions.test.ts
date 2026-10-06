import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { heroOf, PART_B, SLOT_COUNT, weaponAt } from './heroes';
import { addHero, createWorld, makeEnemy, ZONE_HIT } from './world';

const VIEW = { w: 260, h: 380 };

describe('合体武器の枠の番号', () => {
  it('2 つめの部品の番号は、1 つめと同じ動物と枠を指す', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].weapons.push({ id: 'howl', level: 1, cd: 0 });
    for (const slot of [0, 1, 7]) {
      expect(heroOf(slot + PART_B)).toBe(heroOf(slot));
      expect(weaponAt(w, slot + PART_B)).toBe(weaponAt(w, slot));
    }
    expect(PART_B).toBe(SLOT_COUNT);
  });

  it('当たりの時計は、2 つめの部品と炎・ツタのぶんまで分かれている', () => {
    const e = makeEnemy(ENEMIES.caterpillar, 0, 0, 10);
    expect(ZONE_HIT).toBe(SLOT_COUNT * 2);
    expect(e.hit).toHaveLength(ZONE_HIT * 2);
  });
});
