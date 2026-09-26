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

/** 飼っている種類の形の控えを、タイトルのあいだに読んでおく。ほかの種類はひろばとおさんぽに入る前に読む */
async function warmShapes() {
  const [{ loadShapes }, { loadSave }, { graphics }] = await Promise.all([
    import('./models'),
    import('./engine'),
    import('$lib/graphics.svelte')
  ]);
  const save = loadSave();
  if (!save?.pets.length) return;
  const breeds = [...new Set(save.pets.map((p) => p.breed))];
  // iOS の IndexedDB は開くところで止まることがある。控えは速くするためだけのものなので、待ちきれなければ遊ぶときに作る
  await Promise.race([loadShapes(breeds, graphics.quality), new Promise((ok) => setTimeout(ok, 1500))]);
}
