import type { GameMeta } from '$lib/games';

export default {
  id: 'yappari-chameleon',
  name: 'やっぱりカメレオン',
  description:
    '真っ白な体にペンキを吹き付けて屋敷に溶け込み、ペイント銃のハンターから隠れる。1人1台の iPad を横に持って遊ぶ',
  players: 2,
  party: true,
  minutes: '1試合 7分',
  load: async () => ({ Game: (await import('./Yappari.svelte')).default })
} satisfies GameMeta;
