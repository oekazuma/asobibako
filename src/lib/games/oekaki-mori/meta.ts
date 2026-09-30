import type { GameMeta } from '$lib/games';

export default {
  id: 'oekaki-mori',
  name: 'おえかきのもり',
  description: 'ひとりが おだいを えで かいて、みんなで あてる。2〜3にんが ひとり 1だいずつ つかって あそぶ',
  players: 2,
  party: true,
  minutes: '1かい 10ぷん',
  load: async () => ({ Game: (await import('./OekakiMori.svelte')).default })
} satisfies GameMeta;
