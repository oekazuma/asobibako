import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords, record } from './records';
import { STAGES } from './stages';
import { COAST } from './stages/coast';
import { FOREST } from './stages/forest';
import { VOLCANO } from './stages/volcano';
import { overtimeRun, startOvertime } from './overtime';
import { createWorld, summary } from './world';

describe('海岸の表', () => {
  it('火山のあとに並び、火山をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city', 'grove']);
    expect(canPlay(emptyRecords(), 'coast')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow', 'volcano'] }, 'coast')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.47 倍強く、コインは 3 倍、満ち潮は 4 回', () => {
    expect(COAST.length).toBe(FOREST.length);
    expect(COAST.bosses.map((b) => b.at)).toEqual(VOLCANO.bosses.map((b) => b.at));
    expect(COAST.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(COAST.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.47);
    expect(COAST.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.47);
    expect(COAST.coin).toBe(3);
    expect(COAST.tides.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(VOLCANO.tides).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of COAST.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of COAST.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'crab'],
      ['bat', 'gull'],
      ['snake', 'seasnake'],
      ['caterpillar', 'hermit'],
      ['boar', 'walrus'],
      ['spider', 'jelly'],
      ['croc', 'landshark']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('古い記録でも読め、海岸の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'volcano', 'coast', 'nope'], stage: 'coast' }));
    expect(r.stages).toContain('coast');
    expect(r.stage).toBe('coast');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'coast').stage).toBe(COAST);
  });
});

describe('海岸の実績', () => {
  const VIEW = { w: 274, h: 394 };
  const find = (id: string) => ACHIEVEMENTS.find((d) => d.id === id)!;

  it('大ダコと巨大ガニの両方を倒すと満ちる', () => {
    const a = find('coastBosses');
    expect(a.done({ ...emptyRecords(), bosses: ['octopus'] }, null)).toBe(false);
    expect(a.done({ ...emptyRecords(), bosses: ['octopus', 'crabKing'] }, null)).toBe(true);
  });

  it('満ち潮で倒した数を回ごとに記録へ足し、合計 500 体で満ちる', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW, {}, 'coast');
    w.tideKills = 200;
    record(r, summary(w));
    record(r, summary(w));
    expect(r.tideKills).toBe(400);
    const a = find('tide500');
    expect(a.done(r, null)).toBe(false);
    expect(a.progress?.(r)).toEqual([400, 500]);
    record(r, summary(w));
    expect(a.done(r, null)).toBe(true);
  });

  it('古い記録は満ち潮の数 0 で読める', () => {
    expect(parseRecords(JSON.stringify({ coins: 3 })).tideKills).toBe(0);
  });

  it('延長戦の終わりの記録には、延長戦の満ち潮で倒した差だけを足す', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW, {}, 'coast');
    w.tideKills = 30;
    w.time = 600;
    w.over = 'clear';
    record(r, summary(w));
    w.over = null;
    startOvertime(w);
    w.tideKills = 50;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.tideKills).toBe(50);
  });
});
