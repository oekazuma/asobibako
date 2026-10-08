import type { GameMeta } from '$lib/games';

export default {
  id: 'yappari-chameleon',
  name: 'やっぱりカメレオン',
  description: '真っ白な体にペンキを吹き付けて、屋敷に溶け込むかくれんぼ。今は 1 人で試せる試作',
  players: 1,
  levels: 1,
  ownMenu: true,
  landscape: true,
  minutes: 'すきなだけ',
  load: async () => ({
    Game: (await import('./Chameleon.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
