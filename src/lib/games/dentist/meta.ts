import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'dentist',
  name: 'はいしゃさん',
  description: '動物の患者さんの虫歯やよごれを、道具を持ちかえて治す。バイキンはピンセットでゴミ箱へ',
  players: 1,
  levels: 20,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./Dentist.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
