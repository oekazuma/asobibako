import type { GameMeta } from '$lib/games';

export default {
  id: 'border-rush',
  name: 'せめぎあい',
  description: '自分の陣地に出る玉を消して、境界線を相手の端まで押し切る',
  players: 2,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./BorderRush.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
