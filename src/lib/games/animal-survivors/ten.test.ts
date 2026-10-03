import { describe, expect, it } from 'vitest';
import { startOvertime } from './overtime';
import { FINALE, FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { SNOW } from './stages/snow';
import { createWorld, step } from './world';

const VIEW = { w: 274, h: 394 };

describe('10 分の面', () => {
  it('3 つの面はどれも 10 分', () => {
    for (const s of [FOREST, GRAVEYARD, SNOW]) expect(s.length).toBe(600);
  });

  it('ボスは 2・4・6・8 分、面の主は 9 分、ヌシは 1・3・5・7 分', () => {
    expect(FINALE).toBe(540);
    for (const s of [FOREST, GRAVEYARD, SNOW]) {
      expect(s.bosses.map((b) => b.at)).toEqual([120, 240, 360, 480, 540, 540]);
      expect(s.chiefs.map((c) => c.at)).toEqual([60, 180, 300, 420]);
    }
  });

  it('出来事はすべて 10 分のうちに起き、雪山の吹雪も 10 分のうちに 4 回', () => {
    expect(FOREST.events).toHaveLength(16);
    for (const e of FOREST.events) expect(e.at).toBeLessThan(600);
    expect(SNOW.storms.map((s) => s.at)).toEqual([95, 215, 335, 455]);
    for (const w of FOREST.waves) expect(w.to).toBeLessThanOrEqual(600);
  });

  it('10:00 の敵の硬さと攻撃は、15 分だったときの 15:00 と同じ', () => {
    expect(FOREST.toughness(600)).toBeCloseTo(7.5);
    expect(FOREST.fury(600)).toBeCloseTo(2.6);
    expect(FOREST.cap(480)).toBe(400);
    expect(FOREST.elite(150)).toBe(0);
    expect(FOREST.elite(170)).toBeGreaterThan(0);
  });

  it('10:00 でクリアし、延長戦は 10:00 から', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [];
    w.player.hp = w.stats.maxHp = 1e9;
    w.time = 600 - 1e-6;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.over).toBe('clear');
    startOvertime(w);
    expect(w.overtime?.from).toBe(600);
    expect(w.stage.bosses[FOREST.bosses.length].at).toBe(660);
  });

  it('きらきらハリネズミは 2〜8 分のどこか', () => {
    for (let seed = 1; seed < 200; seed++) {
      const at = createWorld('dog', seed, VIEW).metalAt;
      if (at >= 0) {
        expect(at).toBeGreaterThanOrEqual(120);
        expect(at).toBeLessThanOrEqual(480);
      }
    }
  });
});
