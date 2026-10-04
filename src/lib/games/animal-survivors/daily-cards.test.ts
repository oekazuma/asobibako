import { describe, expect, it } from 'vitest';
import { coinMul } from './cauldron';
import { dailyBonus, makeDaily } from './daily';
import { dropFrom } from './drops';
import { ENEMIES } from './enemies';
import { parseRecords } from './records';
import { addEnemy, createWorld } from './world';

const VIEW = { w: 274, h: 394 };
const ANIMALS = ['dog', 'cat', 'wolf'] as const;
const STAGES = ['forest', 'graveyard'];

describe('今日の釜と今日の札', () => {
  it('同じ日付なら同じ釜と札。釜は 2.0〜3.0 の 0.5 刻み、札は開いている札から', () => {
    const a = makeDaily('2026-10-05', [...ANIMALS], STAGES, ['fang', 'gamble']);
    expect(makeDaily('2026-10-05', [...ANIMALS], STAGES, ['fang', 'gamble'])).toEqual(a);
    const days = Array.from({ length: 40 }, (_, i) =>
      makeDaily(`2026-12-${String(i + 1).padStart(2, '0')}`, [...ANIMALS], STAGES, ['fang', 'gamble'])
    );
    for (const d of days) {
      expect([2, 2.5, 3]).toContain(d.heat);
      expect(['fang', 'gamble']).toContain(d.card);
    }
    expect(new Set(days.map((d) => d.heat)).size).toBeGreaterThan(2);
  });

  it('釜と札を足しても、同じ日付の動物・ステージ・しばりは変わらない', () => {
    const old = makeDaily('2026-10-05', [...ANIMALS], STAGES);
    const now = makeDaily('2026-10-05', [...ANIMALS], STAGES, ['fang']);
    expect([now.animal, now.stage, now.mods]).toEqual([old.animal, old.stage, old.mods]);
  });

  it('開いている札が無ければ札なし', () => {
    expect(makeDaily('2026-10-05', [...ANIMALS], STAGES, []).card).toBeUndefined();
  });

  it('ごほうびにはふつうの回のコインと同じ釜の倍率を掛ける', () => {
    const d = { stage: 'forest', mods: ['tough', 'fury'] as const };
    const base = dailyBonus({ ...d, mods: [...d.mods] });
    expect(dailyBonus({ ...d, mods: [...d.mods], heat: 4 })).toBe(Math.round((base * coinMul(4)) / 10) * 10);
  });

  it('前の版で残したお題は釜 2.0・札なしで読み、壊れた札は捨てる', () => {
    const d = { date: '2026-10-05', animal: 'dog', stage: 'forest', mods: ['tough', 'fury'], cleared: false };
    const old = parseRecords(JSON.stringify({ daily: d })).daily!;
    expect(old.heat ?? 2).toBe(2);
    expect(old.card).toBeUndefined();
    const now = parseRecords(JSON.stringify({ daily: { ...d, heat: 3.5, card: 'gamble' } })).daily!;
    expect([now.heat, now.card]).toEqual([3.5, 'gamble']);
    const bad = parseRecords(JSON.stringify({ daily: { ...d, heat: 'x', card: 'nope' } })).daily!;
    expect([bad.heat ?? 2, bad.card]).toEqual([2, undefined]);
  });

  it('お題の回は今日の札を持って始め、ボスを倒すと札を選べる', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', {
      challenge: { date: '2026-10-05', bonus: 200, mods: ['tough', 'fury'], card: 'gamble' },
      arcana: ['fang', 'wisdom', 'gamble']
    });
    expect(w.arcana).toEqual(['gamble']);
    expect(w.arcanaPending).toBe(0);
    const plain = createWorld('dog', 1, VIEW, {}, 'forest', {
      challenge: { date: '2026-10-05', bonus: 200, mods: ['tough', 'fury'] }
    });
    expect(w.stats.might).toBeGreaterThan(plain.stats.might);
    const e = addEnemy(w, { ...ENEMIES.bear, arcana: true }, 0, 0)!;
    e.alive = false;
    dropFrom(w, e);
    expect(w.arcanaPending).toBe(1);
  });
});
