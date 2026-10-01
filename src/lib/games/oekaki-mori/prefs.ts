import type { Length } from './engine';

export const LENGTH_KEY = 'asobibako:oekaki-mori:length';
export const LOOK_KEY = 'asobibako:oekaki-mori:look';

const LENGTH_IDS: readonly Length[] = ['short', 'normal', 'long'];

/** 前に選んだ遊ぶ長さ。読めないときは ふつう */
export function readLength(): Length {
  try {
    const v = localStorage.getItem(LENGTH_KEY);
    return LENGTH_IDS.find((id) => id === v) ?? 'normal';
  } catch {
    return 'normal';
  }
}

export function saveLength(length: Length): void {
  try {
    localStorage.setItem(LENGTH_KEY, length);
  } catch {
    // 覚えられなくても、選んだ長さで遊べる
  }
}
