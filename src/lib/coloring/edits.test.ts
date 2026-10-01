import { describe, expect, it } from 'vitest';
import { applyEdits } from './edits';

const N = 100;

describe('applyEdits', () => {
  it('足した線を描き、消した所を消す。あとの直しが前の直しの上に重なる', () => {
    const base = new Uint8Array(N * N);
    base[50 * N + 20] = 1;
    const out = applyEdits(
      base,
      [
        { kind: 'add', pts: [0.1, 0.5, 0.9, 0.5], width: 4 },
        { kind: 'erase', pts: [0.5, 0.4, 0.5, 0.6], width: 10 }
      ],
      N
    );
    expect(out[50 * N + 80]).toBe(1);
    expect(out[50 * N + 50]).toBe(0);
    expect(out[50 * N + 20]).toBe(1);
    expect(base[50 * N + 80]).toBe(0);
  });

  it('点 1 つの直しも、その場所に丸く効く', () => {
    const out = applyEdits(new Uint8Array(N * N), [{ kind: 'add', pts: [0.3, 0.3], width: 6 }], N);
    expect(out[30 * N + 30]).toBe(1);
    expect(out[30 * N + 32]).toBe(1);
  });
});
