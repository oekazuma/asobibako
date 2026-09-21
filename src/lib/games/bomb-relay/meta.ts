import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'bomb-relay',
  name: 'ばくだんリレー',
  description: '持っているほどメーターがたまる。でも爆発したら半分。はじいて相手に押しつけ合う',
  players: 2,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./BombRelay.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
