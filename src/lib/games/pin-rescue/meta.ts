import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'pin-rescue',
  name: 'ピンぬき',
  description: 'ピンを抜く順番を考えて、金貨を男の子にとどける。マグマに気をつけて',
  players: 1,
  levels: 8,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./PinRescue.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
