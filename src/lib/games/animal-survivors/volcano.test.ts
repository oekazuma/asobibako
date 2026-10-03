import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { ACHIEVEMENTS } from './achievements';
import { overtimeRun, startOvertime } from './overtime';
import { canPlay, emptyRecords, parseRecords, record } from './records';
import { STAGES } from './stages';
import { FOREST } from './stages/forest';
import { SNOW } from './stages/snow';
import { VOLCANO } from './stages/volcano';
import { createWorld, summary } from './world';

describe('火山の表', () => {
  it('雪山のあとに並び、雪山をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano']);
    expect(canPlay(emptyRecords(), 'volcano')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow'] }, 'volcano')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.3 倍強く、コインは 2.5 倍', () => {
    expect(VOLCANO.length).toBe(FOREST.length);
    expect(VOLCANO.bosses.map((b) => b.at)).toEqual(SNOW.bosses.map((b) => b.at));
    expect(VOLCANO.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(VOLCANO.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.3);
    expect(VOLCANO.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.3);
    expect(VOLCANO.coin).toBe(2.5);
    expect(VOLCANO.eruptions.map((e) => e.at)).toEqual([95, 215, 335, 455]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of VOLCANO.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of VOLCANO.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'lizard'],
      ['bat', 'fireball'],
      ['snake', 'lavasnake'],
      ['caterpillar', 'rockworm'],
      ['boar', 'fireboar'],
      ['spider', 'flamespider'],
      ['croc', 'rockcroc']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('古い記録でも読め、火山の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'snow', 'volcano', 'nope'], stage: 'volcano' }));
    expect(r.stages).toContain('volcano');
    expect(r.stage).toBe('volcano');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'volcano').stage).toBe(VOLCANO);
  });
});

describe('火山の実績', () => {
  const VIEW = { w: 274, h: 394 };
  it('溶岩の巨人と不死鳥を倒すと満ちる', () => {
    const a = ACHIEVEMENTS.find((d) => d.id === 'volcanoBosses')!;
    expect(a.done({ ...emptyRecords(), bosses: ['lavaGiant'] }, null)).toBe(false);
    expect(a.done({ ...emptyRecords(), bosses: ['lavaGiant', 'phoenix'] }, null)).toBe(true);
  });

  it('溶岩の池で倒した数を回ごとに記録へ足し、合計 300 体で満ちる', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW, {}, 'volcano');
    w.lavaKills = 120;
    record(r, summary(w));
    record(r, summary(w));
    expect(r.lavaKills).toBe(240);
    const a = ACHIEVEMENTS.find((d) => d.id === 'lava300')!;
    expect(a.done(r, null)).toBe(false);
    expect(a.progress?.(r)).toEqual([240, 300]);
    record(r, summary(w));
    expect(a.done(r, null)).toBe(true);
    expect(parseRecords(JSON.stringify({ coins: 3 })).lavaKills).toBe(0);
  });
});

describe('延長戦と溶岩の数', () => {
  it('延長戦の終わりの記録には、延長戦で溶岩が倒した差だけを足す', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, { w: 274, h: 394 }, {}, 'volcano');
    w.lavaKills = 50;
    w.time = 600;
    w.over = 'clear';
    record(r, summary(w));
    w.over = null;
    startOvertime(w);
    w.lavaKills = 70;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.lavaKills).toBe(70);
  });
});
