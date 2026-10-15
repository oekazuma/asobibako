import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { CITY } from './stages/city';
import { FOREST } from './stages/forest';
import { GROVE } from './stages/grove';
import { createWorld } from './world';

describe('魔法の森の表', () => {
  it('夜の街のあとに並び、夜の街をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city', 'grove']);
    expect(canPlay(emptyRecords(), 'grove')).toBe(false);
    const before = ['forest', 'graveyard', 'snow', 'volcano', 'coast', 'city'];
    expect(canPlay({ ...emptyRecords(), stages: before }, 'grove')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.65 倍強く、コインは 4 倍、妖精の輪は 4 回', () => {
    expect(GROVE.length).toBe(FOREST.length);
    expect(GROVE.bosses.map((b) => b.at)).toEqual(CITY.bosses.map((b) => b.at));
    expect(GROVE.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(GROVE.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.65);
    expect(GROVE.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.65);
    expect(GROVE.coin).toBe(4);
    expect(GROVE.rings.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(GROVE.blackouts).toEqual([]);
    expect(CITY.rings).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of GROVE.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of GROVE.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'shroomling'],
      ['bat', 'pixie'],
      ['snake', 'vineSnake'],
      ['caterpillar', 'gemSnail'],
      ['boar', 'thornBoar'],
      ['spider', 'hopFrog'],
      ['croc', 'stumpGhost']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
      expect(ENEMIES[to].move).toBe(ENEMIES[from].move);
    }
  });

  it('古い記録でも読め、魔法の森の世界を作れ、クリアの実績がある', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'city', 'grove', 'nope'], stage: 'grove' }));
    expect(r.stages).toContain('grove');
    expect(r.stage).toBe('grove');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'grove').stage).toBe(GROVE);
    const a = ACHIEVEMENTS.find((o) => o.id === 'groveClear')!;
    expect(a.coins).toBe(1200);
    expect(a.done(emptyRecords(), null)).toBe(false);
    expect(a.done({ ...emptyRecords(), stages: ['grove'] }, null)).toBe(true);
  });
});
