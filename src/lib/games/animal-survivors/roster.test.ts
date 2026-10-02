import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { stats } from './passives';
import { WEAPONS } from './weapons';

describe('動物', () => {
  it('7 匹いて、最初の武器はどれも表にある', () => {
    expect(ANIMALS.map((a) => a.id)).toEqual(['dog', 'cat', 'wolf', 'fox', 'bear', 'rabbit', 'panda']);
    for (const a of ANIMALS) expect(WEAPONS[a.weapon]).toBeDefined();
  });

  it('新しい 4 匹は表どおりで、特別な強みが stats に入る', () => {
    expect(animal('fox')).toMatchObject({ hp: 85, speed: 1.15, might: 1, weapon: 'flame' });
    expect(animal('bear')).toMatchObject({ hp: 150, speed: 0.85, might: 1.15, weapon: 'claw' });
    expect(animal('rabbit')).toMatchObject({ hp: 75, speed: 1.35, might: 0.85, weapon: 'dash' });
    expect(animal('panda')).toMatchObject({ hp: 130, speed: 0.9, might: 1, weapon: 'vine' });
    expect(stats(animal('fox'), []).crit).toBeCloseTo(0.15);
    expect(stats(animal('bear'), []).armor).toBe(2);
    expect(stats(animal('rabbit'), []).magnet).toBeCloseTo(1.5);
    expect(stats(animal('panda'), []).regen).toBeCloseTo(0.5);
    expect(stats(animal('dog'), []).crit).toBeCloseTo(0.05);
  });

  it('新しい 4 匹には解放の条件と強みの文がある', () => {
    for (const id of ['fox', 'bear', 'rabbit', 'panda'] as const) {
      expect(animal(id).unlock).toBeTruthy();
      expect(animal(id).perk).toBeTruthy();
    }
    for (const id of ['dog', 'cat', 'wolf'] as const) expect(animal(id).unlock).toBeUndefined();
  });
});
