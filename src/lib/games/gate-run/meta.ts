import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'gate-run',
  name: '数のゲート',
  description: '「×2」や「+10」の門をくぐって仲間をふやし、さいごに敵の城をたおす',
  players: 1,
  levels: 30,
  minutes: '30秒',
  Thumb,
  load: async () => ({
    Game: (await import('./GateRun.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
