import type { GameMeta } from '$lib/games';

export default {
  id: 'snow-camp',
  name: '雪原サバイバル',
  description: 'クマやウサギをたおしてお肉をあつめ、たき火でやいてお金をかせぐ。お金で強くなって家を建てよう',
  players: 1,
  levels: 10,
  minutes: '3分',
  load: async () => ({
    Game: (await import('./SnowCamp.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
