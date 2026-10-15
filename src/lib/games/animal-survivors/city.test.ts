import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { streetLightAt } from './blackout';
import { ENEMIES } from './enemies';
import { CELL, obstaclesNear } from './obstacles';
import { canPlay, emptyRecords, parseRecords, record } from './records';
import { STAGES } from './stages';
import { CITY } from './stages/city';
import { COAST } from './stages/coast';
import { FOREST } from './stages/forest';
import { startOvertime, overtimeRun } from './overtime';
import { createWorld, summary } from './world';

describe('夜の街の表', () => {
  it('海岸のあとに並び、海岸をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city', 'grove']);
    expect(canPlay(emptyRecords(), 'city')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow', 'volcano', 'coast'] }, 'city')).toBe(
      true
    );
  });

  it('時刻は森と同じで、森より 1.6 倍強く、コインは 3.5 倍、停電は 4 回', () => {
    expect(CITY.length).toBe(FOREST.length);
    expect(CITY.bosses.map((b) => b.at)).toEqual(COAST.bosses.map((b) => b.at));
    expect(CITY.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(CITY.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.6);
    expect(CITY.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.6);
    expect(CITY.coin).toBe(3.5);
    expect(CITY.blackouts.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(CITY.tides).toEqual([]);
    expect(COAST.blackouts).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of CITY.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of CITY.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'sewerRat'],
      ['bat', 'crow'],
      ['snake', 'civet'],
      ['caterpillar', 'trashGhost'],
      ['boar', 'stray'],
      ['spider', 'gecko'],
      ['croc', 'sewerGator']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
      expect(ENEMIES[to].move).toBe(ENEMIES[from].move);
    }
  });

  it('街灯は区画の位置で決まり、障害物の上と始めの位置のまわりには出ない', () => {
    const g = createWorld('dog', 1, { w: 274, h: 394 }, {}, 'city').stage.art;
    let n = 0;
    for (let cx = -20; cx < 20; cx++)
      for (let cy = -20; cy < 20; cy++) {
        const s = streetLightAt(g, cx, cy);
        expect(streetLightAt(g, cx, cy)).toEqual(s);
        if (!s) continue;
        n++;
        expect(Math.hypot(s.x, s.y)).toBeGreaterThan(120);
        expect(obstaclesNear(g, s.x, s.y, 12, []).length).toBe(0);
        expect(Math.floor(s.x / CELL)).toBe(cx);
      }
    expect(n / 1600).toBeGreaterThan(0.08);
    expect(n / 1600).toBeLessThan(0.25);
  });

  it('街灯は夜の街の面だけに出る', () => {
    for (let cx = -20; cx < 20; cx++)
      for (let cy = -20; cy < 20; cy++) expect(streetLightAt('forest', cx, cy)).toBeNull();
  });

  it('古い記録でも読め、夜の街の世界を作れ、クリアの実績がある', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'coast', 'city', 'nope'], stage: 'city' }));
    expect(r.stages).toContain('city');
    expect(r.stage).toBe('city');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'city').stage).toBe(CITY);
    const a = ACHIEVEMENTS.find((o) => o.id === 'cityClear')!;
    expect(a.done(emptyRecords(), null)).toBe(false);
    expect(a.done({ ...emptyRecords(), stages: ['city'] }, null)).toBe(true);
  });
});

describe('夜の街の実績', () => {
  const VIEW = { w: 274, h: 394 };
  const find = (id: string) => ACHIEVEMENTS.find((d) => d.id === id)!;

  it('巨大カラスと下水の大ワニの両方を倒すと満ちる', () => {
    const a = find('cityBosses');
    expect(a.done({ ...emptyRecords(), bosses: ['raven'] }, null)).toBe(false);
    expect(a.done({ ...emptyRecords(), bosses: ['raven', 'gator'] }, null)).toBe(true);
  });

  it('停電で倒した数を回ごとに記録へ足し、合計 500 体で満ちる', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW, {}, 'city');
    w.blackoutKills = 200;
    record(r, summary(w));
    record(r, summary(w));
    expect(r.blackoutKills).toBe(400);
    const a = find('blackout500');
    expect(a.done(r, null)).toBe(false);
    expect(a.progress?.(r)).toEqual([400, 500]);
    record(r, summary(w));
    expect(a.done(r, null)).toBe(true);
  });

  it('古い記録は停電の数 0 で読める', () => {
    expect(parseRecords(JSON.stringify({ coins: 3 })).blackoutKills).toBe(0);
  });

  it('延長戦の終わりの記録には、延長戦の停電で倒した差だけを足す', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW, {}, 'city');
    w.blackoutKills = 30;
    w.time = 600;
    w.over = 'clear';
    record(r, summary(w));
    w.over = null;
    startOvertime(w);
    w.blackoutKills = 50;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.blackoutKills).toBe(50);
  });
});
