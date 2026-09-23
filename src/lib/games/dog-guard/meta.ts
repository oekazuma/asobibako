import type { GameMeta } from '$lib/games';

export default {
  id: 'dog-guard',
  name: '線を引いて守る',
  description:
    '指で 1 本だけ線をかいて、飛んでくるハチから犬や猫をまもる。線は重さで落ちる。洞窟・雲・巣のとじこめ・ふた落としなど面ごとに仕掛けが変わる',
  players: 1,
  levels: 50,
  minutes: '30秒',
  load: async () => ({
    Game: (await import('./DogGuard.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
