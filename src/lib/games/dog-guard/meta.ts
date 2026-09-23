import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'dog-guard',
  name: '線を引いて守る',
  description:
    '指で 1 本だけ線をかいて、飛んでくるハチから犬や猫をまもる。線は重さで落ちる。洞窟・雲・2 ひきなど面ごとに仕掛けが変わる',
  players: 1,
  levels: 30,
  minutes: '30秒',
  Thumb,
  load: async () => ({
    Game: (await import('./DogGuard.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
