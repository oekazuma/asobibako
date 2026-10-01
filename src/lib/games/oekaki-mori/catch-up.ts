import type { Message } from '$lib/net/link';

interface Sheet {
  /** 配った線画の知らせ。まだ配っていなければ null */
  dealt: Promise<Message> | null;
  colors: Record<number, string>;
  /** 親が「できた！」を押したあと */
  closed: boolean;
}

/**
 * みんなでぬりえに戻った子（途中から来た子）へ、線画・塗った色・「できた！」を送る。
 * 線画は配る知らせを作り終えるのを待ってから送る（親の画面に絵が出る前に戻った子も取りこぼさない）。
 * 色と「できた！」は待ったあとで読む。待つあいだに塗られた色や押された「できた！」も送るため
 */
export async function catchUpTogether(tell: (m: Message) => void, now: () => Sheet): Promise<void> {
  const { dealt } = now();
  if (!dealt) return;
  tell(await dealt);
  const { colors, closed } = now();
  for (const [region, color] of Object.entries(colors)) tell({ t: 'painted', region: +region, color });
  if (closed) tell({ t: 'finished' });
}
