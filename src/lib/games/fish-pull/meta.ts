import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'fish-pull',
  name: 'フィッシュプル',
  description: '1 匹の魚を釣り糸で引っ張り合う。引きすぎると糸が切れ、暴れたら緩めないと逃げられる',
  players: 2,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./FishPull.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
