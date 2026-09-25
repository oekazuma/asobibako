// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Stroke } from './engine';
import { loadStock, pack, place, saveStock, STOCK_KEY } from './stock';

const stroke: Stroke = {
  color: '#fff',
  pts: [
    [0.1234567, 0.5],
    [0.3, 0.7]
  ]
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('stock', () => {
  it('絵のまんなかを原点にして丸め、呼ぶときは好きな場所へ置く', () => {
    const d = pack([stroke], 'a');
    expect(d.strokes[0].pts).toEqual([
      [-0.088, -0.1],
      [0.088, 0.1]
    ]);
    expect(place(d, 1, 1)[0].pts[0]).toEqual([0.912, 0.9]);
  });

  it('保存した絵を読み戻し、壊れた絵は飛ばす', () => {
    saveStock([pack([stroke], 'a')]);
    expect(loadStock().map((d) => d.id)).toEqual(['a']);
    localStorage.setItem(STOCK_KEY, JSON.stringify([{ id: 'x', strokes: [{ color: 1 }] }, pack([stroke], 'b')]));
    expect(loadStock().map((d) => d.id)).toEqual(['b']);
  });

  it('入りきらなければ古い絵から落とす', () => {
    const list = ['new', 'mid', 'old'].map((id) => pack([stroke], id));
    const set = localStorage.setItem.bind(localStorage);
    vi.stubGlobal('localStorage', {
      ...localStorage,
      getItem: localStorage.getItem.bind(localStorage),
      removeItem: localStorage.removeItem.bind(localStorage),
      setItem: (key: string, value: string) => {
        if (value.length > 200) throw new DOMException('full', 'QuotaExceededError');
        set(key, value);
      }
    });
    const kept = saveStock(list);
    expect(kept.length).toBeLessThan(3);
    expect(kept[0].id).toBe('new');
    expect(loadStock().map((d) => d.id)).toEqual(kept.map((d) => d.id));
  });

  it('あふれたときは ★のない古い絵から落とし、★の絵は残す', () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ ...pack([stroke], String(i)), star: i >= 47 }));
    const kept = saveStock(list);
    expect(kept).toHaveLength(48);
    expect(kept.map((d) => d.id).slice(-3)).toEqual(['47', '48', '49']);
    expect(kept.some((d) => d.id === '46')).toBe(false);
  });
});
