// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { DECOR, NATURAL_ROOM, ROOM_PARTS, ROOM_THEMES, decorPrice } from './decor';
import { buy, loadSave, newSave, STORAGE_KEY, writeSave } from './engine';

const rich = () => ({ ...newSave(Date.now() - 1000), money: 100000 });

describe('pet-house decor', () => {
  beforeEach(() => localStorage.clear());

  it('prices every item between 2000 and 15000, and each set below its parts', () => {
    for (const d of DECOR) expect(d.price).toBeGreaterThanOrEqual(2000);
    for (const d of DECOR) expect(d.price).toBeLessThanOrEqual(15000);
    for (const set of DECOR.filter((d) => !d.part)) {
      const sum = DECOR.filter((d) => d.part && d.theme === set.theme).reduce((s, d) => s + d.price, 0);
      expect(set.price).toBeLessThan(sum);
    }
  });

  it('buys a part, applies it and refuses to sell it twice', () => {
    const save = rich();
    expect(buy(save, 'wall:pink')).toBe('ok');
    expect(save.money).toBe(100000 - 2600);
    expect(save.decor).toEqual(['wall:pink']);
    expect(save.room.wall).toBe('pink');
    expect(buy(save, 'wall:pink')).toBe('owned');
  });

  it('charges a set only for the missing parts', () => {
    const save = rich();
    const set = DECOR.find((d) => d.id === 'set:pink')!;
    buy(save, 'sofa:pink');
    save.room.sofa = 'natural';
    const price = decorPrice(save.decor, set);
    expect(price).toBeLessThan(set.price);
    const before = save.money;
    expect(buy(save, 'set:pink')).toBe('ok');
    expect(before - save.money).toBe(price);
    expect(save.decor.filter((k) => k.endsWith(':pink'))).toHaveLength(ROOM_PARTS.length);
    expect(Object.values(save.room).every((t) => t === 'pink')).toBe(true);
    expect(buy(save, 'set:pink')).toBe('owned');
  });

  it('does not buy without money', () => {
    const save = newSave(Date.now());
    expect(buy(save, 'set:castle')).toBe('money');
    expect(save.decor).toEqual([]);
  });

  it('round-trips the room through the save', () => {
    const save = rich();
    buy(save, 'set:wafu');
    save.room.rug = 'natural';
    writeSave(save);
    const back = loadSave()!;
    expect(back.decor).toEqual(save.decor);
    expect(back.room).toEqual(save.room);
  });

  it('repairs broken room data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [] }));
    expect(loadSave()).toMatchObject({ decor: [], room: NATURAL_ROOM });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pets: [],
        decor: ['wall:pink', 'wall:pink', 'set:pink', 'roof:pink', 7, null],
        room: { wall: 'pink', floor: 'castle', rug: 'gold', sofa: 3 }
      })
    );
    const fixed = loadSave()!;
    expect(fixed.decor).toEqual(['wall:pink']);
    // 持っていない部位・知らないテーマはナチュラルに戻る
    expect(fixed.room).toEqual({ ...NATURAL_ROOM, wall: 'pink' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [], decor: 'wall:pink', room: [] }));
    expect(loadSave()).toMatchObject({ decor: [], room: NATURAL_ROOM });
  });

  it('has one item per part and theme plus a set', () => {
    expect(DECOR).toHaveLength((ROOM_THEMES.length - 1) * (ROOM_PARTS.length + 1));
  });
});
