import type { GameMeta } from '$lib/games';

export default {
  id: 'nurie',
  name: 'ぬりえ',
  description: 'いろを えらんで タップすると、せんで かこまれた ところが ぬれる。しゃしんからも ぬりえが つくれる',
  players: 1,
  levels: 1,
  minutes: 'すきなだけ',
  load: async () => ({
    Game: (await import('./Nurie.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
