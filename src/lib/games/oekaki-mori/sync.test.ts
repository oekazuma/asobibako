import { describe, expect, it } from 'vitest';
import { catchUp } from './sync';

describe('catchUp', () => {
  it('遊んでいるあいだは、いまの絵とこれまでの絵を送る', () => {
    const strokes = [{ color: '#000', size: 0.01, pts: [0, 0] }];
    expect(catchUp('play', strokes, [])).toEqual({ t: 'sync', strokes, gallery: [] });
  });

  it('ほかの画面では、その画面を知らせる', () => {
    expect(catchUp('mode', [], [])).toEqual({ t: 'screen', screen: 'mode' });
  });
});
