import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'hockey',
  name: 'ホッケー',
  description: '自分の陣地に置いた指がマレットになる。2 本指で守りながら打ち返せ',
  players: 2,
  minutes: '1〜2分',
  Thumb,
  load: async () => ({
    Game: (await import('./Hockey.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
