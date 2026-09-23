import type { GameMeta } from '$lib/games';

export default {
  id: 'hirameki',
  name: 'ひらめきナゾ',
  description: '思いこみを外せば一瞬で解ける、ひらめきのナゾが 60 問。行きづまったらヒントを開こう',
  players: 1,
  levels: 60,
  levelName: 'ナゾ',
  minutes: '1問 1〜5分',
  load: async () => ({
    Game: (await import('./Hirameki.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
