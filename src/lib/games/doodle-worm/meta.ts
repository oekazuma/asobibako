import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'doodle-worm',
  name: 'らくがきムシ',
  description: 'まるを かいて、せんを かくと、らくがきが ムシになって はいだす。クリアはないので すきなだけ',
  players: 1,
  levels: 1,
  minutes: 'すきなだけ',
  Thumb,
  load: async () => ({
    Game: (await import('./DoodleWorm.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
