import type { GameMeta } from '$lib/games';

export default {
  id: 'pin-rescue',
  name: 'ピンぬき',
  description: 'ピンを抜く順番を考えて、勇者に金貨をとどけ、姫を助ける。マグマと怪物に気をつけて',
  players: 1,
  levels: 27,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./PinRescue.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
