import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { ENEMIES } from './enemies';
import { PASSIVES, stats } from './passives';
import { FOREST, spawnRate } from './stages/forest';
import { MAX_LEVEL, WEAPONS, upText, weaponStats } from './weapons';

describe('データの表', () => {
  it('動物の初期武器と出現表の敵は表にある', () => {
    for (const a of ANIMALS) expect(WEAPONS[a.weapon]).toBeDefined();
    for (const w of FOREST.waves) expect(ENEMIES[w.enemy]).toBeDefined();
  });

  it('武器はどれも Lv5 までの上げ幅を 4 つ持つ', () => {
    for (const d of Object.values(WEAPONS)) expect(d.ups).toHaveLength(d.evolved ? 0 : MAX_LEVEL - 1);
  });

  it('weaponStats は Lv までの上げ幅を足す', () => {
    const d = WEAPONS.woof;
    expect(weaponStats(d, 1)).toEqual(d.base);
    expect(weaponStats(d, 3)).toMatchObject({ damage: 12, amount: 2 });
    expect(weaponStats(d, 5)).toMatchObject({ damage: 12, amount: 3, pierce: 2 });
    expect(weaponStats(d, 5).cooldown).toBeCloseTo(0.75);
  });

  it('upText は上げ幅を言葉にする', () => {
    expect(upText(WEAPONS.woof, 2)).toBe('ダメージ +20%');
    expect(upText(WEAPONS.woof, 3)).toBe('発射数 +1');
    expect(upText(WEAPONS.woof, 5)).toBe('発射数 +1・貫通 +1');
    expect(upText(WEAPONS.boomerang, 4)).toBe('大きさ +25%');
  });

  it('stats はパッシブを Lv の分だけ足す', () => {
    const s = stats(animal('cat'), [
      { id: 'heart', level: 2 },
      { id: 'paws', level: 1 }
    ]);
    expect(s.maxHp).toBe(130);
    expect(s.speed).toBeCloseTo(1.35);
    expect(Object.keys(PASSIVES)).toHaveLength(13);
  });

  it('出現の速さは範囲の中で線形、外は 0', () => {
    const w = FOREST.waves[0];
    expect(spawnRate(w, 0)).toBeCloseTo(0.8);
    expect(spawnRate(w, 150)).toBeCloseTo(1.9);
    expect(spawnRate(w, 300)).toBe(0);
    expect(FOREST.cap(0)).toBe(30);
    expect(FOREST.cap(720)).toBe(400);
  });
});
