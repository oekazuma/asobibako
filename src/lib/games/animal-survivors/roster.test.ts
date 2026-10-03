import { describe, expect, it } from 'vitest';
import { emptyRecords, parseRecords, record } from './records';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step, summary, type RunSummary } from './world';
import { ANIMALS, animal } from './animals';
import { stats } from './passives';
import { WEAPONS } from './weapons';

describe('動物', () => {
  it('9 匹いて、最初の武器はどれも表にある', () => {
    expect(ANIMALS.map((a) => a.id)).toEqual([
      'dog',
      'cat',
      'wolf',
      'fox',
      'bear',
      'rabbit',
      'panda',
      'tiger',
      'drake'
    ]);
    for (const a of ANIMALS) expect(WEAPONS[a.weapon]).toBeDefined();
  });

  it('解放する 6 匹は表どおりで、特別な強みが stats に入る', () => {
    expect(animal('fox')).toMatchObject({ hp: 90, speed: 1.15, might: 1.05, weapon: 'flame' });
    expect(animal('bear')).toMatchObject({ hp: 155, speed: 0.85, might: 1.2, weapon: 'claw' });
    expect(animal('rabbit')).toMatchObject({ hp: 80, speed: 1.35, might: 0.9, weapon: 'dash' });
    expect(animal('panda')).toMatchObject({ hp: 150, speed: 0.9, might: 1.15, weapon: 'vine' });
    expect(animal('tiger')).toMatchObject({ hp: 135, speed: 1.2, might: 1.35, weapon: 'tigerClaw' });
    expect(animal('drake')).toMatchObject({ hp: 140, speed: 1.1, might: 1.35, weapon: 'breath' });
    expect(stats(animal('fox'), []).crit).toBeCloseTo(0.15);
    expect(stats(animal('bear'), []).armor).toBe(2);
    expect(stats(animal('rabbit'), []).magnet).toBeCloseTo(1.5);
    expect(stats(animal('panda'), []).regen).toBeCloseTo(1);
    expect(stats(animal('drake'), [])).toMatchObject({ armor: 1, regen: 0.3 });
    expect(stats(animal('dog'), []).crit).toBeCloseTo(0.05);
  });

  it('解放する 6 匹には解放の条件と強みの文がある', () => {
    for (const id of ['fox', 'bear', 'rabbit', 'panda', 'tiger', 'drake'] as const) {
      expect(animal(id).unlock).toBeTruthy();
      expect(animal(id).perk).toBeTruthy();
    }
    for (const id of ['dog', 'cat', 'wolf'] as const) expect(animal(id).unlock).toBeUndefined();
  });
});

const run = (o: Partial<RunSummary>): RunSummary => ({
  animal: 'dog',
  cleared: false,
  time: 100,
  level: 5,
  kills: 100,
  xp: 0,
  weapons: [],
  passives: [],
  bosses: [],
  coins: 0,
  opened: 0,
  evolved: [],
  dealt: [],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  ...o
});

/** その回のごほうびで仲間になった動物 */
const pets = (r: ReturnType<typeof emptyRecords>, s: RunSummary) =>
  record(r, s).flatMap((a) => (a.animal ? [a.animal] : []));

describe('記録と解放', () => {
  it('初めは犬・猫・狼だけ', () => {
    expect(emptyRecords().unlocked).toEqual(['dog', 'cat', 'wolf']);
  });

  it('森をクリアするとキツネ。一度解放したものはもう返さない', () => {
    const r = emptyRecords();
    expect(pets(r, run({ time: 600 }))).toEqual([]);
    expect(pets(r, run({ time: 900, cleared: true }))).toEqual(['fox']);
    expect(r.unlocked).toContain('fox');
    expect(pets(r, run({ time: 900, cleared: true }))).toEqual([]);
    expect(r.clears).toBe(2);
  });

  it('同じ回で 2 匹の条件を満たせば 2 匹とも解放する', () => {
    const r = emptyRecords();
    expect(pets(r, run({ time: 900, cleared: true, finale: true }))).toEqual(['fox', 'bear']);
  });

  it('撃破の合計 20000 でウサギ', () => {
    const r = emptyRecords();
    expect(pets(r, run({ kills: 10000 }))).toEqual([]);
    expect(pets(r, run({ kills: 10000 }))).toEqual(['rabbit']);
  });

  it('壊れた保存や型の違う値は空の記録として読む', () => {
    expect(parseRecords(null)).toEqual(emptyRecords());
    expect(parseRecords('{oops')).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ best: 'x', kills: 50, unlocked: ['fox', 'nope'] }))).toEqual({
      ...emptyRecords(),
      kills: 50,
      unlocked: ['dog', 'cat', 'wolf', 'fox'],
      book: { ...emptyRecords().book, forms: ['fox:0'] }
    });
  });

  it('その回に倒したボスがリザルトに入る', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    w.stage = { ...w.stage, waves: [], bosses: [] };
    w.spawnAcc = [];
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    w.enemies.push(makeEnemy({ ...ENEMIES.bear, speed: 0 }, 60, 0, 1));
    for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).bosses).toEqual(['bear']);
  });
});
