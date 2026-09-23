import { describe, expect, it } from 'vitest';
import { bank, cross, equation, grid, linesCover, pour, riverStart } from './engine';
import type { LinesQ, RiverQ } from './types';

describe('hirameki engine', () => {
  it('マッチ棒の式は、数字の形と式がなりたつかを見る', () => {
    const eq = equation('6+4=4');
    expect(eq.goal(new Set(eq.on))).toBe(false);
    // + の縦棒を 6 の右上へ動かすと 8-4=4
    const eight = [...eq.on.filter((i) => i !== 8), 1];
    expect(eq.goal(new Set(eight))).toBe(true);
  });

  it('方眼は正方形の大きさと、正方形に使われていない棒を数える', () => {
    const g = grid(2, 2);
    const all = new Set(g.slots.map((_, i) => i));
    expect(g.squares(all).sizes.sort()).toEqual([1, 1, 1, 1, 2]);
    expect(g.squares(all).allUsed).toBe(true);
  });

  it('川わたりは、残した岸の組み合わせでしっぱいになる', () => {
    const p: RiverQ = {
      kind: 'river',
      cap: 2,
      crossers: [
        { id: 'f', name: 'ひと', color: '#fff', rows: true },
        { id: 'w', name: 'オオカミ', color: '#999' },
        { id: 'g', name: 'ヒツジ', color: '#eee' }
      ],
      danger: (b) => (!b.has('f') && b.has('w') && b.has('g') ? 'たべられた' : null)
    };
    expect(cross(p, riverStart(), ['w'])).toEqual({ warn: 'ボートをこげる者がいません' });
    expect(cross(p, riverStart(), ['f'])).toMatchObject({ fail: 'たべられた' });
    const r = cross(p, riverStart(), ['f', 'g']);
    expect('next' in r && !('fail' in r) && [...bank(p, r.next, 1)].sort()).toEqual(['f', 'g']);
  });

  it('注ぐと、空になるか満タンになるところで止まる', () => {
    expect(pour([8, 0, 0], [8, 5, 3], 0, 2)).toEqual([5, 0, 3]);
    expect(pour([5, 0, 3], [8, 5, 3], 2, 1)).toEqual([5, 3, 0]);
  });

  it('一筆の直線は、はみ出した点で曲がれば 9 つの点を 4 本で通れる', () => {
    const at = (x: number, y: number) => ({ x, y });
    const dots = [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => at(x, y)));
    const pegs = [-1, 0, 1, 2, 3].flatMap((y) => [-1, 0, 1, 2, 3].map((x) => at(x, y)));
    const p: LinesQ = { kind: 'lines', dots, pegs, segments: 4 };
    const i = (x: number, y: number) => pegs.findIndex((q) => q.x === x && q.y === y);
    expect(linesCover(p, [i(0, 0), i(2, 0), i(2, 2), i(0, 2), i(0, 0)])).toBe(false);
    expect(linesCover(p, [i(-1, -1), i(2, 2), i(2, -1), i(-1, 2), i(2, 2)])).toBe(true);
    // 5 本目は引けない
    expect(linesCover(p, [i(0, 0), i(2, 0), i(2, 2), i(0, 2), i(0, 1), i(2, 1)])).toBe(false);
  });
});
