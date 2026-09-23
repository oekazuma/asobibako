import type { GameMeta } from '$lib/games';

export default {
  id: 'lightning',
  name: 'ライトニング',
  description: '出た指示どおりにタップ・長押し・スワイプ。早いもの勝ちだけど、ドクロとおてつきに注意',
  players: 2,
  minutes: '30秒',
  load: async () => ({
    Game: (await import('./Lightning.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
