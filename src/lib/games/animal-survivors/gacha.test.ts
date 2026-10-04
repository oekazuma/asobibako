import { describe, expect, it } from 'vitest';
import {
  BAG_MAX,
  bagCount,
  canPull,
  equip,
  merge,
  pull,
  PULL_COINS,
  rollTicket,
  sell,
  ticketOdds,
  wornKeys
} from './gacha';
import { emptyRecords, parseRecords } from './records';

const fixed = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('ガチャ券', () => {
  it('釜 2.0 以下は銅だけ、9.0 は銅 3 割・銀 5 割・金 2 割', () => {
    expect(ticketOdds(1)).toEqual([1, 0, 0]);
    const o = ticketOdds(9);
    expect(o[0]).toBeCloseTo(0.3);
    expect(o[1]).toBeCloseTo(0.5);
    expect(o[2]).toBeCloseTo(0.2);
    expect(rollTicket(9, 0.1)).toBe(0);
    expect(rollTicket(9, 0.5)).toBe(1);
    expect(rollTicket(9, 0.95)).toBe(2);
  });
});

describe('ガチャ', () => {
  it('コインで引くと 500 枚払って持ち物が 1 つ増える', () => {
    const r = { ...emptyRecords(), coins: 600 };
    const got = pull(r, 'coin', fixed(0.5, 0));
    expect(got).toEqual(['hachimaki:0']);
    expect(r.coins).toBe(600 - PULL_COINS);
    expect(r.bag['hachimaki:0']).toBe(1);
    expect(r.pity).toBe(1);
  });

  it('券で引くとその券を 1 枚使い、銀の券はレア以上', () => {
    const r = { ...emptyRecords(), tickets: [0, 1, 0] as [number, number, number] };
    const got = pull(r, 'silver', fixed(0, 0))!;
    expect(got[0].endsWith(':1')).toBe(true);
    expect(r.tickets).toEqual([0, 0, 0]);
    expect(pull(r, 'silver', fixed(0))).toBe(null);
  });

  it('伝説が出ないまま 50 回めは伝説で、天井を数え直す', () => {
    const r = { ...emptyRecords(), coins: 500, pity: 49 };
    const got = pull(r, 'coin', fixed(0, 0))!;
    expect(got[0].endsWith(':2')).toBe(true);
    expect(r.pity).toBe(0);
  });

  it('10 連は 4500 枚で 10 こ、ふつうだけなら最後をレアにする', () => {
    const r = { ...emptyRecords(), coins: 4500 };
    const got = pull(r, 'ten', fixed(0, 0))!;
    expect(got).toHaveLength(10);
    expect(got.filter((k) => !k.endsWith(':0'))).toHaveLength(1);
    expect(r.coins).toBe(0);
  });

  it('持ち物が上限を越える 10 連は何も払わずに断る', () => {
    const r = { ...emptyRecords(), coins: 9999, bag: { 'owl:0': BAG_MAX - 2 } };
    expect(canPull(r, 'ten')).toBe(false);
    expect(pull(r, 'ten', fixed(0))).toBe(null);
    expect(r.coins).toBe(9999);
    expect(bagCount(r)).toBe(BAG_MAX - 2);
  });
});

describe('持ち物', () => {
  it('同じ品・同じレア度 3 つで 1 段上へ。伝説は合成できない', () => {
    const r = { ...emptyRecords(), bag: { 'owl:0': 4, 'owl:2': 3 } };
    expect(merge(r, 'owl:0')).toBe('owl:1');
    expect(r.bag).toEqual({ 'owl:0': 1, 'owl:1': 1, 'owl:2': 3 });
    expect(merge(r, 'owl:0')).toBe(null);
    expect(merge(r, 'owl:2')).toBe(null);
  });

  it('売るとコインになり、最後の 1 つを売るとつけていた場所は空く', () => {
    const r = { ...emptyRecords(), bag: { 'knight:1': 1 } };
    equip(r, 'knight:1');
    expect(wornKeys(r)).toEqual(['knight:1']);
    expect(sell(r, 'knight:1')).toBe(200);
    expect(r.coins).toBe(200);
    expect(r.worn.body).toBe(null);
    expect(r.bag['knight:1']).toBeUndefined();
  });

  it('つけている品を合成して数が 0 になると、その場所は空く', () => {
    const r = { ...emptyRecords(), bag: { 'oni:0': 3 } };
    equip(r, 'oni:0');
    merge(r, 'oni:0');
    expect(r.worn.head).toBe(null);
  });

  it('つけるとその品の場所に入り、同じ場所の前の品は外れる', () => {
    const r = { ...emptyRecords(), bag: { 'oni:0': 1, 'hachimaki:2': 1 } };
    equip(r, 'oni:0');
    equip(r, 'hachimaki:2');
    expect(r.worn).toEqual({ head: 'hachimaki:2', body: null, charm: null });
  });
});

describe('記録の読み', () => {
  it('古い保存は空で読み、壊れた値と知らない鍵を捨てる', () => {
    const empty = parseRecords(JSON.stringify({ best: 10 }));
    expect(empty.bag).toEqual({});
    expect(empty.worn).toEqual({ head: null, body: null, charm: null });
    expect(empty.tickets).toEqual([0, 0, 0]);
    expect(empty.pity).toBe(0);
    const r = parseRecords(
      JSON.stringify({
        bag: { 'owl:1': 2, 'dragon:1': 5, 'oni:7': 1, 'cat:0': -3 },
        worn: { head: 'owl:1', body: 'cloak:2', charm: 'owl:1' },
        tickets: [2, 'x', 1],
        pity: 12.7
      })
    );
    expect(r.bag).toEqual({ 'owl:1': 2 });
    // 持っていない品と、場所の違う品はつけない
    expect(r.worn).toEqual({ head: null, body: null, charm: 'owl:1' });
    expect(r.tickets).toEqual([2, 0, 1]);
    expect(r.pity).toBe(12);
  });

  it('形の崩れた名前は正しい名前に直して足し、直せないものは捨てる', () => {
    const r = parseRecords(
      JSON.stringify({
        bag: { 'hachimaki:1.0': 2, 'hachimaki:1': 1, 'owl:': 3, 'owl:1:x': 1, 'cat:0x1': 1 },
        worn: { head: 'hachimaki:1.0' }
      })
    );
    expect(r.bag).toEqual({ 'hachimaki:1': 3 });
    expect(r.worn.head).toBe('hachimaki:1');
  });
});
