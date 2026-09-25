import type { GameMeta } from '$lib/games';

export default {
  id: 'pet-house',
  name: 'わんにゃんハウス',
  description: 'いぬや ねこを むかえて、なでたり ごはんを あげたり、おさんぽしたり。クリアは ないので すきなだけ',
  players: 1,
  levels: 1,
  minutes: 'すきなだけ',
  load: async () => {
    const [game, howto] = await Promise.all([import('./PetHouse.svelte'), import('./Howto.svelte'), warmShapes()]);
    return { Game: game.default, Howto: howto.default };
  }
} satisfies GameMeta;

/** 前に作ったペットの形の控え（IndexedDB）を、タイトルのあいだに読んでおく。無ければ遊ぶときに作る */
async function warmShapes() {
  const [{ loadShapes }, { BREED_IDS }, { graphics }] = await Promise.all([
    import('./models'),
    import('./breeds'),
    import('$lib/graphics.svelte')
  ]);
  await loadShapes(BREED_IDS, graphics.quality);
}
