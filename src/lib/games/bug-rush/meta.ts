import type { GameMeta } from '$lib/games';

export default {
  id: 'bug-rush',
  name: '虫送り',
  description: 'わらわら湧く虫をタップして相手の陣地へ。30 秒後に残りが少ないほうの勝ち',
  players: 2,
  minutes: '30秒',
  load: async () => ({
    Game: (await import('./BugRush.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
