import type { GameMeta } from '$lib/games';

export default {
  id: 'pet-house',
  name: 'わんにゃんハウス',
  description: 'いぬや ねこを むかえて、なでたり ごはんを あげたり、おさんぽしたり。クリアは ないので すきなだけ',
  players: 1,
  levels: 1,
  minutes: 'すきなだけ',
  load: async () => ({
    Game: (await import('./PetHouse.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
