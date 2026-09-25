// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { adopt, catchUp, count, loadSave, newSave, STORAGE_KEY, TRICKS, writeSave, type Pet } from './engine';
import { check, nearly, STAMPS, suggest } from './stamps';

const HOUR = 3600 * 1000;
const NOW = Date.now() - 1000 * HOUR;

describe('pet-house stamps', () => {
  beforeEach(() => localStorage.clear());

  it('30〜40 こで、id は重ならず、条件は 1 以上', () => {
    expect(STAMPS.length).toBeGreaterThanOrEqual(30);
    expect(STAMPS.length).toBeLessThanOrEqual(40);
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(STAMPS.length);
    for (const s of STAMPS) expect(s.need).toBeGreaterThanOrEqual(1);
  });

  it('はじめの保存では何も押されず、条件を満たすと 1 度だけ押されてごほうびも 1 度だけ', () => {
    const save = newSave(NOW);
    expect(check(save)).toEqual([]);
    adopt(save, 'shiba', 'ハチ');
    for (let i = 0; i < 9; i++) count(save, 'bath');
    const before = save.money;
    expect(check(save).map((s) => s.id)).toEqual(['bath1']);
    expect(save.money).toBe(before + 100);
    count(save, 'bath');
    expect(check(save).map((s) => s.id)).toEqual(['bath10']);
    const money = save.money;
    expect(check(save)).toEqual([]);
    expect(save.money).toBe(money);
    expect(save.stamps).toEqual(['bath1', 'bath10']);
  });

  it('ハート・芸・コンテスト・なかまは save から数え直す', () => {
    const save = newSave(NOW);
    const pet = adopt(save, 'shiba', 'ハチ') as Pet;
    pet.love = 3.2;
    pet.tricks = Object.fromEntries(TRICKS.map((t) => [t.id, t.steps]));
    save.contest = { frisbee: 5, wand: 1, agility: 1, obedience: 1 };
    save.money = 10000;
    adopt(save, 'mike', 'ミケ');
    const ids = check(save).map((s) => s.id);
    for (const id of [
      'heart1',
      'heart3',
      'trick1',
      'trick5',
      'trickAll',
      'win1',
      'win4',
      'champ-frisbee',
      'pets2',
      'both'
    ])
      expect(ids).toContain(id);
    for (const id of ['heart5', 'champ-wand', 'champAll', 'pets3']) expect(ids).not.toContain(id);
  });

  it('遊んだ日数は日付が変わったときだけ 1 つ増える', () => {
    const save = newSave(NOW);
    expect(save.counters.days).toBe(1);
    catchUp(save, NOW + 1000);
    catchUp(save, NOW + 30 * HOUR);
    catchUp(save, NOW + 31 * HOUR);
    expect(save.counters.days).toBe(2);
  });

  it('おすすめは進んだもの、あと少しのヒントは 7 わり以上のものだけ', () => {
    const save = newSave(NOW);
    adopt(save, 'shiba', 'ハチ');
    expect(nearly(save)).toBeUndefined();
    for (let i = 0; i < 15; i++) count(save, 'fetch');
    expect(nearly(save)?.id).toBe('fetch20');
    expect(suggest(save)?.id).toBe('fetch20');
    save.stamps = STAMPS.map((s) => s.id);
    expect(suggest(save)).toBeUndefined();
  });

  it('保存から戻り、古い保存や壊れた値は補う', () => {
    const save = newSave(NOW);
    save.stamps = ['meal1'];
    count(save, 'meal', 3);
    writeSave(save);
    expect(loadSave()?.stamps).toEqual(['meal1']);
    expect(loadSave()?.counters.meal).toBe(3);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pets: [] }));
    const old = loadSave()!;
    expect(old.stamps).toEqual([]);
    expect(old.counters).toEqual(newSave(NOW).counters);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stamps: ['a', 'a', 3, null, 'x'.repeat(99)],
        counters: { meal: -4, bath: 2.7, walk: 'x', dragon: 9 }
      })
    );
    const bad = loadSave()!;
    expect(bad.stamps).toEqual(['a']);
    expect(bad.counters.meal).toBe(0);
    expect(bad.counters.bath).toBe(2);
    expect(bad.counters.walk).toBe(0);
    expect(bad.counters.days).toBe(1);
    expect('dragon' in bad.counters).toBe(false);
  });
});
