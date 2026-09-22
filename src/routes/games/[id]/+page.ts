import { error } from '@sveltejs/kit';
import { games } from '$lib/games';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => games.map((game) => ({ id: game.id }));

export const load: PageLoad = async ({ params }) => {
  const meta = games.find((game) => game.id === params.id);
  if (!meta) error(404, 'ゲームが見つかりません');
  // meta と本体の組を 1 つにまとめて、画面側で players による絞り込みが本体の型にも効くようにする
  const play =
    meta.players === 1
      ? { solo: true as const, meta, ...(await meta.load()) }
      : { solo: false as const, meta, ...(await meta.load()) };
  return { play };
};
