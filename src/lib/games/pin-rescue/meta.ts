import type { GameMeta } from '$lib/games';

export default {
  id: 'pin-rescue',
  name: 'ピンぬき',
  description: 'ピンを抜く順番を考えて、金貨をとどけ、怪物をたおし、姫を助ける。マグマや毒ガス、爆弾に気をつけて',
  players: 1,
  levels: 50,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./PinRescue.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
