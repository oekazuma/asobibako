import { describe, expect, it } from 'vitest';
import { inPinch, PINCH, RAISE_BLESS, RAISE_SECS } from './heroes';
import { addHero, createWorld, hurtPlayer, step, type World } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

/** 2 匹めが倒れていて、1 匹めがそばにいる */
function rescue(): World {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.heroes[0].player.x = 190;
  w.heroes[1].player.x = 200;
  w.heroes[1].down = true;
  w.heroes[1].player.hp = 0;
  return w;
}

/** 起こし終わるまで進め、そのあいだの出来事をためる */
function untilRaised(w: World) {
  const seen: World['events'] = [];
  for (let i = 0; i < 200 && w.heroes[1].down; i++) {
    step(w, still, 1 / 60);
    seen.push(...w.events);
  }
  return seen;
}

describe('起こしたごほうび', () => {
  it('起こすと 2 匹とも力と風のご利益が 10 秒増え、残りがあれば足される', () => {
    const w = rescue();
    w.heroes[0].blessing.might = 4;
    untilRaised(w);
    expect(w.heroes[1].down).toBe(false);
    expect(w.heroes[0].blessing.might).toBeCloseTo(4 + RAISE_BLESS - RAISE_SECS, 0);
    expect(w.heroes[0].blessing.speed).toBeGreaterThan(RAISE_BLESS - 0.1);
    expect(w.heroes[1].blessing.might).toBeGreaterThan(RAISE_BLESS - 0.1);
    expect(w.heroes[1].blessing.speed).toBeGreaterThan(RAISE_BLESS - 0.1);
  });

  it('起き上がると持ち主の付かない raised が出て、revive は出ない', () => {
    const w = rescue();
    const seen = untilRaised(w);
    const r = seen.filter((e) => e.type === 'raised');
    expect(r).toEqual([{ type: 'raised', who: 1, by: 0 }]);
    expect(seen.some((e) => e.type === 'revive')).toBe(false);
  });

  it('自分で起き上がったとき（店の復活）はご利益が増えない', () => {
    const w = createWorld('dog', 5, VIEW);
    addHero(w, 'cat');
    w.revives = 1;
    w.player.hp = 1;
    hurtPlayer(w, 999);
    expect(w.player.hp).toBeGreaterThan(0);
    expect(w.heroes[0].blessing.might).toBe(0);
    expect(w.heroes[1].blessing.might).toBe(0);
  });

  it('起こしているあいだは 1 秒ごとに raising が出て、離れたら始めから数え直す', () => {
    const w = rescue();
    const seen: World['events'] = [];
    for (let i = 0; i < 70; i++) {
      step(w, still, 1 / 60);
      seen.push(...w.events);
    }
    expect(seen.filter((e) => e.type === 'raising')).toEqual([{ type: 'raising', who: 1, step: 1 }]);
    w.heroes[0].player.x = 0;
    step(w, still, 1 / 60);
    w.heroes[0].player.x = 190;
    seen.length = 0;
    for (let i = 0; i < 70; i++) {
      step(w, still, 1 / 60);
      seen.push(...w.events);
    }
    expect(seen.filter((e) => e.type === 'raising')).toEqual([{ type: 'raising', who: 1, step: 1 }]);
  });

  it('起こす側が倒れていれば起き上がらず、ご利益も出ない', () => {
    const w = rescue();
    w.heroes[0].down = true;
    for (let i = 0; i < 200; i++) step(w, still, 1 / 60);
    expect(w.heroes[1].down).toBe(true);
    expect(w.heroes[1].blessing.might).toBe(0);
  });
});

describe('ピンチ', () => {
  it('HP が 3 割を切ったときと倒れているあいだだけピンチ、抜けた動物はピンチにしない', () => {
    const w = createWorld('dog', 5, VIEW);
    addHero(w, 'cat');
    const h = w.heroes[1];
    h.player.hp = h.stats.maxHp * PINCH;
    expect(inPinch(h)).toBe(false);
    h.player.hp = h.stats.maxHp * PINCH - 1;
    expect(inPinch(h)).toBe(true);
    h.player.hp = h.stats.maxHp;
    h.down = true;
    expect(inPinch(h)).toBe(true);
    h.gone = true;
    expect(inPinch(h)).toBe(false);
  });
});
