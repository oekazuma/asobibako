import type { GameMeta } from '$lib/games';

export default {
  id: 'doodle-worm',
  name: 'らくがきパレード',
  description: 'すきな えを かいて「うごけ！」を おすと、かたちに あわせて うごきだす。クリアはないので すきなだけ',
  players: 1,
  levels: 1,
  minutes: 'すきなだけ',
  load: async () => ({
    Game: (await import('./DoodleWorm.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
