// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { loadLook, LOOK_KEY, LOOKS, mix, saveLook } from './looks';

afterEach(() => localStorage.clear());

describe('絵柄', () => {
  it('選んだ絵柄を覚え、知らない値や空なら最初の絵柄に戻る', () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(loadLook()).toBe(LOOKS[0]);
    saveLook(LOOKS[1]);
    expect(loadLook()).toBe(LOOKS[1]);
    localStorage.setItem(LOOK_KEY, 'gone');
    expect(loadLook()).toBe(LOOKS[0]);
  });

  it('2 つの色を混ぜる', () => {
    expect(mix('#ff0000', '#0000ff', 0.5)).toBe('rgb(128 0 128)');
    expect(mix('#2b2d42', '#ffffff', 0)).toBe('rgb(43 45 66)');
  });
});
