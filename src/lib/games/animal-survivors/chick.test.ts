import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { emptyRecords, parseRecords } from './records';
import { createWorld, hurtPlayer } from './world';

const VIEW = { w: 274, h: 394 };

describe('火の鳥のひな', () => {
  it('最強の段で、火の羽根を持ち、火山のクリアで仲間になる', () => {
    const a = animal('chick');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['火の鳥のひな', '炎の若鳥', '火の鳥']);
    expect(a.weapon).toBe('fireFeather');
    expect(ACHIEVEMENTS.find((d) => d.id === 'volcanoClear')?.animal).toBe('chick');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['volcanoClear'] }));
    expect(r.unlocked).toContain('chick');
  });

  it('倒れると一度だけ HP 半分でよみがえり、店の復活はそのあとに残る', () => {
    const w = createWorld('chick', 1, VIEW, { revive: 1 });
    w.stats.armor = 0;
    expect(w.rebirths).toBe(1);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
    expect(w.player.invuln).toBeGreaterThanOrEqual(2);
    expect(w.rebirths).toBe(0);
    expect(w.revives).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm' && e.text === 'よみがえった！')).toBe(true);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.revives).toBe(0);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });

  it('お題の HP 半分でも、その回の最大 HP の半分で戻る', () => {
    const w = createWorld('chick', 1, VIEW, {}, 'forest', { challenge: { date: 'x', bonus: 0, mods: ['halfHp'] } });
    hurtPlayer(w, 1e9);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
  });

  it('ほかの動物はよみがえらない', () => {
    const w = createWorld('drake', 1, VIEW);
    expect(w.rebirths).toBe(0);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });
});
