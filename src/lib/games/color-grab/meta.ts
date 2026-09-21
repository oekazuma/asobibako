import type { GameMeta } from '$lib/games';

export default {
  id: 'color-grab',
  name: 'いろとり',
  description: 'まん中の玉から、お題の色を自分の陣地へ。違う色は相手に押しつけろ',
  players: 2,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./ColorGrab.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
