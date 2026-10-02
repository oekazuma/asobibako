import { describe, expect, it } from 'vitest';
import { PendingPause, canPause } from './pause';
import { createWorld } from './world';

describe('一時停止', () => {
  it('決着したあと・3 択や宝箱が出ているあいだは開かない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    expect(canPause(w, false)).toBe(true);
    expect(canPause(w, true)).toBe(false);
    w.over = 'dead';
    expect(canPause(w, false)).toBe(false);
  });

  it('3 択のあいだに画面が隠れたら、選び終えたときに開く', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const later = new PendingPause();
    expect(later.hide(w, true)).toBe(false);
    expect(later.due(w, true)).toBe(false);
    expect(later.due(w, false)).toBe(true);
    expect(later.due(w, false)).toBe(false);
    expect(later.hide(w, false)).toBe(true);
    expect(later.due(w, false)).toBe(false);
  });

  it('決着したあとに隠れても覚えない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    w.over = 'dead';
    const later = new PendingPause();
    expect(later.hide(w, false)).toBe(false);
    expect(later.due(w, false)).toBe(false);
  });
});
