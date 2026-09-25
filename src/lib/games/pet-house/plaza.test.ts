import { describe, expect, it } from 'vitest';
import { BREED_IDS, BREEDS } from './breeds';
import { roster } from './plaza.svelte';
import type { BreedId } from './types';

const rng = () => {
  let seed = 3;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
};
const kinds = (list: BreedId[]) => list.map((b) => BREEDS[b].kind);

describe('pet-house ふれあいひろば', () => {
  it('出すのは 8 匹で、同じ種類はいない。犬と猫が 4 匹ずつ交互に並ぶ', () => {
    const list = roster([], [], rng());
    expect(list).toHaveLength(8);
    expect(new Set(list).size).toBe(8);
    expect(kinds(list)).toEqual(['dog', 'cat', 'dog', 'cat', 'dog', 'cat', 'dog', 'cat']);
  });

  it('飼っている種類はあとに回す', () => {
    const owned: BreedId[] = ['shiba', 'poodle', 'mike'];
    for (let i = 0; i < 20; i++) expect(roster(owned, [], Math.random).some((b) => owned.includes(b))).toBe(false);
  });

  it('入れ替えると、いま出ていない種類が先に出て、2 回で全部の種類に会える', () => {
    const r = rng();
    const first = roster([], [], r);
    const second = roster([], first, r);
    const dogs = BREED_IDS.filter((b) => BREEDS[b].kind === 'dog');
    for (const dog of dogs) expect(first.includes(dog) !== second.includes(dog)).toBe(true);
    expect(new Set([...first, ...second])).toEqual(new Set(BREED_IDS));
  });
});
