import { error } from '@sveltejs/kit';
import { games } from '$lib/games';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => games.map((game) => ({ id: game.id }));

export const load: PageLoad = async ({ params }) => {
  const meta = games.find((game) => game.id === params.id);
  if (!meta) error(404, 'ゲームが見つかりません');
  return { meta, ...(await meta.load()) };
};
