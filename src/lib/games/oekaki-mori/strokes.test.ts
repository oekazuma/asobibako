import { describe, expect, it } from 'vitest';
import { apply, render, renderTail, snap, type Stroke } from './strokes';

const start = (x: number, y: number) => ({ k: 'start' as const, color: '#000', size: 0.01, x, y });

describe('apply', () => {
  it('start で線を始め、add で最後の線に点を足す', () => {
    let s: Stroke[] = [];
    s = apply(s, start(0.1, 0.2));
    s = apply(s, { k: 'add', pts: [0.3, 0.4, 0.5, 0.6] });
    expect(s).toEqual([{ color: '#000', size: 0.01, pts: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] }]);
  });

  it('元の配列と線を書き換えない', () => {
    const before = apply([], start(0, 0));
    const after = apply(before, { k: 'add', pts: [1, 1] });
    expect(before[0].pts).toEqual([0, 0]);
    expect(after).not.toBe(before);
  });

  it('線が無いときの add は何もしない', () => {
    expect(apply([], { k: 'add', pts: [1, 1] })).toEqual([]);
  });

  it('undo は最後の線だけを消し、clear は全部消す', () => {
    let s = apply(apply([], start(0, 0)), start(1, 1));
    s = apply(s, { k: 'undo' });
    expect(s.map((x) => x.pts)).toEqual([[0, 0]]);
    expect(apply(s, { k: 'clear' })).toEqual([]);
    expect(apply([], { k: 'undo' })).toEqual([]);
  });
});

/** 描いた命令だけを記録する ctx */
function recorder() {
  const calls: [string, ...number[]][] = [];
  const ctx = {
    canvas: { width: 100, height: 100 },
    setTransform: () => {},
    fillRect: () => {},
    beginPath: () => calls.push(['begin']),
    moveTo: (x: number, y: number) => calls.push(['move', x, y]),
    lineTo: (x: number, y: number) => calls.push(['line', x, y]),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => calls.push(['curve', cx, cy, x, y]),
    stroke: () => calls.push(['stroke'])
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const line = { color: '#000', size: 0.01, pts: [0, 0, 0.2, 0, 0.2, 0.2, 0, 0.2] };

describe('render', () => {
  // 点を直線でつなぐと、速く描いたときに角ばる
  it('点どうしの中点を通る曲線でつなぐ', () => {
    const { ctx, calls } = recorder();
    render(ctx, [line]);
    expect(calls).toEqual([
      ['begin'],
      ['move', 0, 0],
      ['curve', 0.2, 0, 0.2, 0.1],
      ['curve', 0.2, 0.2, 0.1, 0.2],
      ['line', 0, 0.2],
      ['stroke']
    ]);
  });
});

describe('renderTail', () => {
  // 1 点足すたびに絵を全部描き直すと、絵が混むほど遅れる
  it('描き終えたところの 1 つ前の中点から、足した点までだけを描く', () => {
    const { ctx, calls } = recorder();
    renderTail(ctx, line, 3);
    expect(calls).toEqual([['begin'], ['move', 0.2, 0.1], ['curve', 0.2, 0.2, 0.1, 0.2], ['line', 0, 0.2], ['stroke']]);
  });
});

describe('snap', () => {
  // 送る数を小数 4 けた（盤面の 1 万分の 1、画素より細かい）に丸め、知らせを小さくする
  it('小数 4 けたに丸める', () => {
    expect(snap(0.123456789)).toBe(0.1235);
  });
});
