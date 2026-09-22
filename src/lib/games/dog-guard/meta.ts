import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'dog-guard',
  name: '線を引いて守る',
  description: '指で 1 本だけ線をかいて、飛んでくるハチから犬を 8 秒まもる',
  players: 1,
  minutes: '30秒',
  Thumb,
  load: async () => ({
    Game: (await import('./DogGuard.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
