import type { GameMeta } from '$lib/games';

export default {
  id: 'megaphone-dash',
  name: 'メガホンダッシュ',
  description:
    'メガホンで通行人の群れをまとめてファンにしながら、教室までダッシュ。コンボで速くなり、ボスには大声をあびせる',
  players: 1,
  levels: 15,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./MegaphoneDash.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
