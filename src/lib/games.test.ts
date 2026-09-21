import { describe, expect, it } from 'vitest';
import { games } from './games';

describe('games', () => {
  it('id は重複せず、URL にそのまま使える kebab-case', () => {
    const ids = games.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('どのゲームも本体と遊び方を読み込める', async () => {
    for (const game of games) {
      const { Game, Howto } = await game.load();
      expect(Game, game.id).toBeTypeOf('function');
      expect(Howto, game.id).toBeTypeOf('function');
    }
  });
});
