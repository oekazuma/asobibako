import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { TROPHY_GROUPS } from './trophy-groups';

describe('実績の見出し', () => {
  it('どの実績もどこか 1 つの見出しにだけ入る', () => {
    const ids = TROPHY_GROUPS.flatMap(([, list]) => list);
    expect([...ids].sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });
});
