import { describe, expect, it } from 'vitest';
import { paintBy, shared, undoBy } from './together';

describe('paintBy', () => {
  it('塗った場所と色を返し、表に入れる', () => {
    const s = shared();
    expect(paintBy(s, 2, 5, '#f00')).toEqual({ region: 5, color: '#f00' });
    expect(s.colors).toEqual({ 5: '#f00' });
  });

  it('同じ色での塗り直しと、場所の無いところ（-1）は何もしない', () => {
    const s = shared();
    paintBy(s, 2, 5, '#f00');
    expect(paintBy(s, 3, 5, '#f00')).toBeNull();
    expect(paintBy(s, 3, -1, '#f00')).toBeNull();
    expect(s.dabs).toHaveLength(1);
  });
});

describe('undoBy', () => {
  it('押した人の塗りだけを新しい順に戻す', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 2, '#0f0');
    paintBy(s, 2, 1, '#00f');
    expect(undoBy(s, 2)).toEqual({ region: 1, color: '#f00' });
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
    expect(s.colors).toEqual({ 2: '#0f0' });
  });

  it('ほかの人が上から塗ったところは飛ばして、その前の自分の塗りを戻す', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 2, 2, '#f00');
    paintBy(s, 3, 2, '#00f');
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
    expect(s.colors).toEqual({ 2: '#00f' });
  });

  it('上から塗った人が戻すと、下の人の色に戻り、その人はさらに戻せる', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 1, '#00f');
    expect(undoBy(s, 3)).toEqual({ region: 1, color: '#f00' });
    expect(undoBy(s, 2)).toEqual({ region: 1, color: null });
  });

  it('戻せる手順が無ければ何もしない', () => {
    const s = shared();
    paintBy(s, 3, 1, '#00f');
    expect(undoBy(s, 2)).toBeNull();
    expect(s.colors).toEqual({ 1: '#00f' });
  });
});
