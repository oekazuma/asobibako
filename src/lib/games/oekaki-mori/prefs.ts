import type { Length } from './engine';
import { LOOKS, type Look } from './looks';

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

/** この端末の動物。はじめてのときや読めないときは、ランダムに選んで覚える */
export function readLook(rand = Math.random): Look {
  try {
    const found = LOOKS.find((look) => look.id === localStorage.getItem(LOOK_KEY));
    if (found) return found.id;
  } catch {
    // 読めなければ選び直す
  }
  const picked = LOOKS[Math.floor(rand() * LOOKS.length)].id;
  saveLook(picked);
  return picked;
}

export function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    // 覚えられなくても、この回は選んだ動物で遊べる
  }
}
