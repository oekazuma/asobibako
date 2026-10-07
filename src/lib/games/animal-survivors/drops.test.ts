import { describe, expect, it } from 'vitest';
import { apply, choices, SLOTS } from './choices';
import { collect, dropGem, gainXp, MAX_GEMS, xpNeed } from './drops';
import { PASSIVES } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld } from './world';

const VIEW = { w: 260, h: 380 };
const fresh = () => createWorld('dog', 2, VIEW);

describe('経験値', () => {
  it('必要量は 5 から 10 ずつ、Lv10 から 22 ずつ、Lv20 から 40 ずつ増える', () => {
    expect(xpNeed(1)).toBe(5);
    expect(xpNeed(2)).toBe(15);
    expect(xpNeed(10)).toBe(95);
    expect(xpNeed(11)).toBe(117);
    expect(xpNeed(20)).toBe(315);
    expect(xpNeed(21)).toBe(355);
  });

  it('Lv30 から 60 ずつ、Lv40 から 72 ずつ増え、後半はレベルが上がりにくい', () => {
    expect(xpNeed(29)).toBe(675);
    expect(xpNeed(30)).toBe(720);
    expect(xpNeed(31)).toBe(780);
    expect(xpNeed(40)).toBe(1320);
    expect(xpNeed(41)).toBe(1392);
  });

  it('一度に 2 つ上がれば 3 択が 2 回たまる', () => {
    const w = fresh();
    gainXp(w, 22);
    expect(w.level).toBe(3);
    expect(w.pending).toBe(2);
    expect(w.events.filter((e) => e.type === 'levelup')).toHaveLength(2);
  });

  it('玉があふれたら遠い玉に値を足し、経験値は消えない', () => {
    const w = fresh();
    for (let i = 0; i < MAX_GEMS; i++) dropGem(w, 100 + i, 0, 1);
    dropGem(w, 50, 0, 7);
    const alive = w.gems.filter((g) => g.alive);
    expect(alive).toHaveLength(MAX_GEMS);
    expect(alive.reduce((s, g) => s + g.value, 0)).toBe(MAX_GEMS + 7);
    expect(alive.find((g) => g.x === 100 + MAX_GEMS - 1)!.value).toBe(8);
  });

  it('近い玉は吸い寄せられて拾える', () => {
    const w = fresh();
    dropGem(w, 20, 0, 3);
    for (let i = 0; i < 30; i++) collect(w, 1 / 60);
    expect(w.xp).toBe(3);
  });
});

describe('3 択', () => {
  it('同じものは重ならず、3 枚出る', () => {
    const w = fresh();
    const c = choices(w);
    expect(c).toHaveLength(3);
    expect(new Set(c.map((x) => JSON.stringify(x))).size).toBe(3);
  });

  it('枠が埋まったら持っていないものは出ない', () => {
    const w = fresh();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: 1, cd: 0 }));
    w.passives = Object.keys(PASSIVES)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: 1 }));
    for (let i = 0; i < 50; i++)
      for (const c of choices(w)) {
        if (c.kind === 'weapon') expect(w.weapons.some((o) => o.id === c.id)).toBe(true);
        if (c.kind === 'passive') expect(w.passives.some((o) => o.id === c.id)).toBe(true);
      }
  });

  it('全部 Lv5 なら限界突破と最大 HP の札だけになり、選び続けても止まる', () => {
    const w = fresh();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
    w.passives = Object.keys(PASSIVES)
      .slice(0, SLOTS)
      .map((id) => ({ id, level: MAX_LEVEL }));
    w.pending = 1;
    for (const c of choices(w)) expect(['limit', 'vigor']).toContain(c.kind);
    let guard = 0;
    while (w.pending > 0 && guard++ < 1000) apply(w, { kind: 'vigor' });
    expect(w.pending).toBe(0);
  });

  it('パッシブを取るとステータスが変わり、最大 HP の分だけ今の HP も増える', () => {
    const w = fresh();
    w.pending = 1;
    w.player.hp = 50;
    apply(w, { kind: 'passive', id: 'heart', level: 1 });
    expect(w.stats.maxHp).toBe(120);
    expect(w.player.hp).toBe(70);
    expect(w.pending).toBe(0);
  });

  it('武器を取ると Lv が上がる', () => {
    const w = fresh();
    w.pending = 1;
    apply(w, { kind: 'weapon', id: 'woof', level: 2 });
    expect(w.weapons[0].level).toBe(2);
  });
});
