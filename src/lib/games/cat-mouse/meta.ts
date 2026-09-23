import type { GameMeta } from '$lib/games';

export default {
  id: 'cat-mouse',
  name: 'ネコとネズミ',
  description: 'ネコは追いかけ、ネズミはチーズを食べて逃げる。1 回ごとに役を交代して、チーズの数で勝負',
  players: 2,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./CatMouse.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
