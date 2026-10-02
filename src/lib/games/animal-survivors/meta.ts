import type { GameMeta } from '$lib/games';

export default {
  id: 'animal-survivors',
  name: 'Animal Survivors',
  description: '動物を選んで、押し寄せる大群を 15 分生き延びる。攻撃は自動、レベルアップで技を選ぶ',
  players: 1,
  levels: 1,
  ownMenu: true,
  minutes: '15分',
  load: async () => ({
    Game: (await import('./Survivors.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
