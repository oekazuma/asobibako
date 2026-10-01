import { describe, expect, it } from 'vitest';
import type { Entry } from './relay';
import { relayLayout } from './relay-album';

const prompt: Entry = { kind: 'prompt', text: 'りんご' };
const draw: Entry = { kind: 'draw', by: 1, strokes: [] };
const guess: Entry = { kind: 'guess', by: 2, text: 'とまと' };

describe('relayLayout', () => {
  it('リレーごとに縦の列を作り、列どうしもこまどうしも重ならない', () => {
    const columns = [
      [prompt, draw, guess, draw, guess],
      [prompt, draw, guess, prompt, draw, guess]
    ];
    const { width, height, cells } = relayLayout(columns);
    expect(cells.map((c) => c.length)).toEqual([5, 6]);
    const all = cells.flat();
    for (const c of all) {
      expect(c.x + c.w).toBeLessThanOrEqual(width);
      expect(c.y + c.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const [a, b] = [all[i], all[j]];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });
});
