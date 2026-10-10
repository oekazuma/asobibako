import { describe, expect, it } from 'vitest';
import { standout } from './senses3d';

/** 1 画素 = [r, g, b, a] を並べた絵 */
const img = (...px: number[][]) => new Uint8Array(px.flat());

describe('standout', () => {
  it('体の画素（少しでも違う画素）のうち、diff より違う画素の割合を返す', () => {
    const bg = [100, 100, 100, 255];
    const without = img(bg, bg, bg, bg, bg, bg);
    // 体の画素は 4 つ（差 1・20・40・200）、まわりは同じ
    const withBody = img([101, 100, 100, 255], [120, 100, 100, 255], [100, 60, 100, 255], [100, 100, 255, 255], bg, bg);
    expect(standout(withBody, without, 0.12)).toBe(2 / 4);
    expect(standout(withBody, without, 0.5)).toBe(1 / 4);
    expect(standout(withBody, without, 0.001)).toBe(1);
  });

  it('体の画素がほとんど無ければ 0', () => {
    const bg = [0, 0, 0, 255];
    expect(standout(img([255, 255, 255, 255], [255, 0, 0, 255], bg), img(bg, bg, bg), 0.12)).toBe(0);
  });
});
