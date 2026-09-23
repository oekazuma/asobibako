import type { GameMeta } from '$lib/games';

export default {
  id: 'hockey',
  name: 'ホッケー',
  description: '自分の陣地に置いた指がマレットになる。パックを相手のゴールへ打ち込め',
  players: 2,
  minutes: '1〜2分',
  load: async () => ({
    Game: (await import('./Hockey.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
