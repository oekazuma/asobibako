import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { COAST } from './stages/coast';
import { FOREST } from './stages/forest';
import { VOLCANO } from './stages/volcano';
import { createWorld } from './world';

describe('海岸の表', () => {
  it('火山のあとに並び、火山をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast']);
    expect(canPlay(emptyRecords(), 'coast')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow', 'volcano'] }, 'coast')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.6 倍強く、コインは 3 倍、満ち潮は 4 回', () => {
    expect(COAST.length).toBe(FOREST.length);
    expect(COAST.bosses.map((b) => b.at)).toEqual(VOLCANO.bosses.map((b) => b.at));
    expect(COAST.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(COAST.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.6);
    expect(COAST.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.6);
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
