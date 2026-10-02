import { describe, expect, it } from 'vitest';
import { canPause } from './pause';
import { createWorld } from './world';

describe('一時停止', () => {
  it('決着したあと・3 択や宝箱が出ているあいだは開かない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    expect(canPause(w, false)).toBe(true);
    expect(canPause(w, true)).toBe(false);
    w.over = 'dead';
    expect(canPause(w, false)).toBe(false);
  });
});
