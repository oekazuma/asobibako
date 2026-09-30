import type { Message } from '$lib/net/link';
import type { Drawing } from './Result.svelte';
import type { Stroke } from './strokes';

export type Screen = 'lobby' | 'mode' | 'play' | 'result' | 'together';

/**
 * 戻った子（途中から来た子）へ最初に送る 1 通。遊びの見え方は審判が送り直すので、ここでは絵だけを送る。
 * みんなでぬりえは Together が線画と色を送る
 */
export function catchUp(screen: Screen, strokes: Stroke[], gallery: Drawing[]): Message {
  if (screen === 'play' || screen === 'result') return { t: 'sync', strokes, gallery };
  return { t: 'screen', screen };
}
