import type { GameMeta } from '$lib/games';

export default {
  id: 'gate-run',
  name: '数のゲート',
  description: '仲間といっしょに撃ちながら進み、門の数字を撃ってふやし、せまる敵とボスをたおす',
  players: 1,
  levels: 30,
  minutes: '1分',
  load: async () => ({
    Game: (await import('./GateRun.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
