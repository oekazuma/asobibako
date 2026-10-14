import { describe, expect, it } from 'vitest';
import { MAX_STEPS } from '$lib/coloring/paint';
import { paintBy, paintFrom, recolor, shared, undoBy } from './together';

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

  // 色が同じかだけを見ると、ほかの人が同じ色で塗り直したところを自分の塗りと見分けられない
  it('ほかの人が上から同じ色で塗り直していたら、その塗りを消さない', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 1, '#00f');
    paintBy(s, 3, 1, '#f00');
    expect(undoBy(s, 2)).toBeNull();
    expect(s.colors).toEqual({ 1: '#f00' });
    expect(undoBy(s, 3)).toEqual({ region: 1, color: '#00f' });
  });

  it('その場所のいちばん新しい自分の塗りでも、いまの色がちがえば戻さない', () => {
    const s = shared();
    paintBy(s, 2, 1, '#f00');
    paintBy(s, 3, 1, '#00f');
    paintBy(s, 2, 1, '#0f0');
    expect(undoBy(s, 3)).toBeNull();
    expect(undoBy(s, 2)).toEqual({ region: 1, color: '#00f' });
    expect(undoBy(s, 2)).toBeNull();
    expect(s.colors).toEqual({ 1: '#00f' });
  });
});

describe('paintFrom', () => {
  it('配った線画にある番号とパレットの形の色だけを塗る', () => {
    const s = shared();
    expect(paintFrom(s, 2, { t: 'paint', region: 3, color: '#f04438' }, 4)).toEqual({ region: 3, color: '#f04438' });
    for (const [region, color] of [
      [NaN, '#f04438'],
      [1.5, '#f04438'],
      [-1, '#f04438'],
      [4, '#f04438'],
      ['2', '#f04438'],
      [2, '#f00'],
      [2, 'red'],
      [2, null]
    ])
      expect(paintFrom(s, 2, { t: 'paint', region, color }, 4)).toBeNull();
    expect(s.colors).toEqual({ 3: '#f04438' });
    expect(s.dabs).toHaveLength(1);
  });

  it('戻す手順は、ひとりのぬりえと同じ数までにする', () => {
    const s = shared();
    for (let i = 0; i < MAX_STEPS + 5; i++) paintBy(s, 2, 0, i % 2 ? '#f04438' : '#3bb54a');
    expect(s.dabs).toHaveLength(MAX_STEPS);
  });
});

describe('recolor', () => {
  it('色の変化を新しい表にして返し、白に戻す null も受ける', () => {
    const colors = { 1: '#f04438' };
    expect(recolor(colors, { t: 'painted', region: 2, color: '#3bb54a' }, 4)).toEqual({ 1: '#f04438', 2: '#3bb54a' });
    expect(recolor(colors, { t: 'painted', region: 1, color: null }, 4)).toEqual({});
    expect(colors).toEqual({ 1: '#f04438' });
  });

  it('形の違う変化は、表をそのまま返す', () => {
    const colors = { 1: '#f04438' };
    for (const [region, color] of [
      [null, '#3bb54a'],
      [4, '#3bb54a'],
      [2, 'red'],
      [2, undefined]
    ])
      expect(recolor(colors, { t: 'painted', region, color }, 4)).toBe(colors);
  });
});
