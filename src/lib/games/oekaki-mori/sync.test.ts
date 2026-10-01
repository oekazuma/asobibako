import { describe, expect, it } from 'vitest';
import { catchUp } from './sync';

describe('catchUp', () => {
  // DataChannel の 1 通には上限があり、絵をまとめて送ると越えることがある
  it('遊んでいるあいだは、いまの絵とこれまでの絵を 1 枚ずつ別の知らせで送る', () => {
    const strokes = [{ color: '#000', size: 0.01, pts: [0, 0] }];
    const drawing = { word: 'いぬ', by: 1 as const, strokes, misses: [] };
    expect(catchUp('play', strokes, [drawing, drawing], [{ by: 2, text: 'いぬ' }])).toEqual([
      { t: 'sync', strokes, misses: [{ by: 2, text: 'いぬ' }] },
      { t: 'drawing', drawing },
      { t: 'drawing', drawing }
    ]);
  });

  it('ほかの画面では、その画面を知らせる', () => {
    expect(catchUp('mode', [], [], [])).toEqual([{ t: 'screen', screen: 'mode' }]);
  });
});
