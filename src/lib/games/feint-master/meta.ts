import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'feint-master',
  name: 'フェイントマスター',
  description: '押していい合図の、色と形を半分ずつしか知らない。相手の手の動きを読むか、釣るか',
  players: 2,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./FeintMaster.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
