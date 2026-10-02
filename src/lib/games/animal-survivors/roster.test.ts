import { describe, expect, it } from 'vitest';
import { emptyRecords, parseRecords, record } from './records';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step, summary, type RunSummary } from './world';
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
  ...o
});

/** その回のごほうびで仲間になった動物 */
const pets = (r: ReturnType<typeof emptyRecords>, s: RunSummary) =>
  record(r, s).flatMap((a) => (a.animal ? [a.animal] : []));

describe('記録と解放', () => {
  it('初めは犬・猫・狼だけ', () => {
    expect(emptyRecords().unlocked).toEqual(['dog', 'cat', 'wolf']);
  });

  it('5 分生き延びるとキツネ。一度解放したものはもう返さない', () => {
    const r = emptyRecords();
    expect(pets(r, run({ time: 299 }))).toEqual([]);
    expect(pets(r, run({ time: 300 }))).toEqual(['fox']);
    expect(r.unlocked).toContain('fox');
    expect(pets(r, run({ time: 400 }))).toEqual([]);
    expect(r.best).toBe(400);
  });

  it('同じ回で 2 匹の条件を満たせば 2 匹とも解放する', () => {
    const r = emptyRecords();
    expect(pets(r, run({ time: 310, bosses: ['bear'] }))).toEqual(['fox', 'bear']);
  });

  it('撃破の合計 3000 でウサギ、クリアでパンダ', () => {
    const r = emptyRecords();
    expect(pets(r, run({ kills: 1500 }))).toEqual([]);
    expect(pets(r, run({ kills: 1500 }))).toEqual(['rabbit']);
    expect(pets(r, run({ time: 900, cleared: true }))).toEqual(['fox', 'panda']);
    expect(r.clears).toBe(1);
  });

  it('壊れた保存や型の違う値は空の記録として読む', () => {
    expect(parseRecords(null)).toEqual(emptyRecords());
    expect(parseRecords('{oops')).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ best: 'x', kills: 50, unlocked: ['fox', 'nope'] }))).toEqual({
      ...emptyRecords(),
      kills: 50,
      unlocked: ['dog', 'cat', 'wolf', 'fox']
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
