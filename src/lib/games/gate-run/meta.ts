import type { GameMeta } from '$lib/games';

export default {
  id: 'gate-run',
  name: '数のゲート',
  description: '1 人から撃ちながら進み、門の数字を撃ってふやして仲間をふやし、せまる敵をぜんぶたおす',
  players: 1,
  levels: 30,
  minutes: '30秒',
  load: async () => ({
    Game: (await import('./GateRun.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
