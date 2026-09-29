import type { GameMeta } from '$lib/games';

export default {
  id: 'idol-live',
  name: 'ときめきステージ',
  description:
    'アイドルの ミオと いっしょに ライブ！ うたと ダンスに あわせて ひかりに タッチして、ステージを もりあげよう',
  players: 1,
  levels: 1,
  minutes: '1きょく 1ぷん',
  load: async () => ({
    Game: (await import('./IdolLive.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
