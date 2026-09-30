import { describe, expect, it } from 'vitest';
import { empty, fill, undo } from './paint';

describe('fill と undo', () => {
  it('場所に色を塗り、塗る前の色を覚える', () => {
    const c = fill(fill(empty(), 3, '#f00'), 3, '#00f');
    expect(c.colors).toEqual({ 3: '#00f' });
    expect(c.history).toEqual([
      { region: 3, before: null },
      { region: 3, before: '#f00' }
    ]);
  });

  it('同じ色で塗りなおしても、戻す並びを増やさない', () => {
    const c = fill(empty(), 1, '#f00');
    expect(fill(c, 1, '#f00')).toBe(c);
  });

  it('場所の無いところ（-1）は塗らない', () => {
    const c = empty();
    expect(fill(c, -1, '#f00')).toBe(c);
  });

  it('何回でも戻せ、最初の色に戻すと表から消える', () => {
    let c = fill(fill(fill(empty(), 1, '#f00'), 2, '#0f0'), 1, '#00f');
    c = undo(c);
    expect(c.colors).toEqual({ 1: '#f00', 2: '#0f0' });
    c = undo(undo(c));
    expect(c.colors).toEqual({});
    expect(undo(c)).toBe(c);
  });

  it('元の状態を書き換えない', () => {
    const a = fill(empty(), 1, '#f00');
    fill(a, 2, '#0f0');
    undo(a);
    expect(a.colors).toEqual({ 1: '#f00' });
  });
});
