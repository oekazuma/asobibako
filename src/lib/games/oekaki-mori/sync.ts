import type { Message } from '$lib/net/link';
import type { Drawing, Miss } from './Result.svelte';
import type { Stroke } from './strokes';

export type Screen = 'lobby' | 'mode' | 'play' | 'result' | 'together' | 'relay';

/**
 * 戻った子（途中から来た子）へ最初に送る知らせ。遊びの見え方は審判が送り直すので、ここでは絵だけを送る。
 * DataChannel の 1 通には上限（Chrome で 256KiB）があるので、これまでの絵は 1 枚ずつ別に送る。
 * みんなでぬりえは Together が線画と色を送る
 */
export function catchUp(screen: Screen, strokes: Stroke[], gallery: Drawing[], misses: Miss[]): Message[] {
  if (screen !== 'play' && screen !== 'result') return [{ t: 'screen', screen }];
  return [{ t: 'sync', strokes, misses }, ...gallery.map((drawing) => ({ t: 'drawing', drawing }))];
}
