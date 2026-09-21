import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'shield-break',
  name: 'シールドブレイク',
  description: '拍に合わせて、ためる・攻撃・ガードを同時に出し合う読み合い。盾はだんだん壊れる',
  players: 2,
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./ShieldBreak.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
