import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { Match, MODES, winnerText } from './match.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';

const at = (me: Seat, v: Partial<View>) => {
  const m = new Match(() => me);
  m.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, ...v });
  return m;
};

describe('Match', () => {
  it('残り秒は次の知らせまで手元で減らし、強制挑発の秒は探索のあいだだけ減らす', () => {
    const m = at(1, { phase: 'hide', left: 10, taunts: { 1: 5 } });
    m.advance(0.5);
    expect(m.left).toBeCloseTo(9.5);
    expect(m.taunt).toBe(5);
    m.receive({ ...m.view, phase: 'search', left: 300 });
    m.advance(1);
    expect(m.taunt).toBe(4);
    expect(m.left).toBeCloseTo(299);
  });

  it('白い人形は見つかっていない隠れる人、赤い人形はハンターの数', () => {
    const m = at(1, { phase: 'search', found: [2] });
    expect(m.hiders).toBe(1);
    expect(m.hunters).toBe(1);
  });

  it('フェーズの言葉は役で変わる', () => {
    expect(at(1, { phase: 'hide' }).word).toBe('探索開始まで');
    expect(at(3, { phase: 'hide' }).word).toBe('探索開始まで');
    expect(at(1, { phase: 'search' }).word).toBe('隠れつづけよう');
    expect(at(3, { phase: 'search' }).word).toBe('探索時間');
    expect(at(1, { phase: 'reveal' }).word).toBe('答え合わせ');
  });

  it('観戦するのは、通常で見つかった人と、試合の途中から来た人', () => {
    expect(at(1, { phase: 'search', found: [1], settings: { ...DEFAULTS, mode: 'normal' } }).watching()).toBe(true);
    expect(at(1, { phase: 'search', found: [1], roles: { 1: 'hunter', 3: 'hunter' } }).watching()).toBe(false);
    expect(at(2, { phase: 'search', roles: { 1: 'hider', 2: 'out', 3: 'hunter' } }).watching()).toBe(true);
  });

  it('勝者の言葉。ダブルは勝った人の名前か勝者なし', () => {
    const v = view(newMatch());
    expect(winnerText({ ...v, winner: 'chameleon' })).toBe('勝者カメレオン!');
    expect(winnerText({ ...v, winner: 'hunter' })).toBe('勝者ハンター!');
    expect(winnerText({ ...v, winner: 'double', champ: 2 })).toBe('勝者 プレイヤー2!');
    expect(winnerText({ ...v, winner: 'double', champ: null })).toBe('勝者なし');
    expect(winnerText(v)).toBeNull();
  });

  it('ダブルのモード名はマゼンタ、ほかは緑', () => {
    expect(MODES.double).toMatchObject({ name: 'ダブル', color: '#e8399c' });
    expect(MODES.double.lines).toEqual(['最初に全員で隠れる。', 'その後全員で探索し、最初に全員見つければ勝利']);
    expect(MODES.infect.color).toBe('#7cc243');
  });

  const double = { ...DEFAULTS, mode: 'double' } as const;

  it('ダブルでは、隠れタイムは探索開始まで、探索は全員が「全員を見つけよう」', () => {
    const roles = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
    expect(at(1, { phase: 'hide', settings: double, roles: { 1: 'hider', 2: 'hider', 3: 'hider' } }).word).toBe(
      '探索開始まで'
    );
    expect(at(1, { phase: 'search', settings: double, roles }).word).toBe('全員を見つけよう');
    expect(at(2, { phase: 'search', settings: double, roles }).double).toBe(true);
  });

  it('順位表は見つけた数の多い順、同じ数なら先に届いた順で、見つける数はほかの人の数', () => {
    const m = at(1, {
      phase: 'search',
      settings: double,
      hid: [1, 2, 3],
      caught: { 2: [1], 3: [1] },
      reached: { 2: 40, 3: 12 }
    });
    expect(m.ranking).toEqual([
      { seat: 3, got: 1, need: 2 },
      { seat: 2, got: 1, need: 2 },
      { seat: 1, got: 0, need: 2 }
    ]);
  });

  it('見落とした敵は自分の点の多い順で、1 点に満たない人は出さない', () => {
    const m = at(3, { phase: 'search', overlook: { 3: { 1: 4, 2: 12 }, 2: { 1: 99 } } });
    expect(m.overlooked).toEqual([
      { seat: 2, pts: 12 },
      { seat: 1, pts: 4 }
    ]);
    expect(at(3, { phase: 'search', overlook: { 3: { 1: 0 } } }).overlooked).toEqual([]);
  });

  it('見落とされた場所は、隠れた人ごとの全ハンターの点の合計の順と、いた部屋の名前', () => {
    const m = at(1, {
      phase: 'reveal',
      hid: [1, 2],
      overlook: { 3: { 1: 4, 2: 12 }, 1: { 2: 3 } },
      spots: { 1: [-16, 0, 10], 2: [12, 0, 6] }
    });
    expect(m.spotted).toEqual([
      { seat: 2, pts: 15, place: '書斎' },
      { seat: 1, pts: 4, place: 'キッチン' }
    ]);
  });
});
