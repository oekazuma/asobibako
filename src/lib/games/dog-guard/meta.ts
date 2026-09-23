import type { GameMeta } from '$lib/games';

export default {
  id: 'dog-guard',
  name: '線を引いて守る',
  description: '指で 1 本だけ線をかいて、飛んでくるハチから犬をまもる。洞窟・雲・2 ひきの犬など面ごとに仕掛けが変わる',
  players: 1,
  levels: 30,
  minutes: '30秒',
  load: async () => ({
    Game: (await import('./DogGuard.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
