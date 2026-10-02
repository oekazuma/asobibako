import { describe, expect, it } from 'vitest';
import { frameAt, viewSize } from './draw';

describe('仮想画面', () => {
  it('幅が 260 ドット前後になる整数の倍率を選ぶ', () => {
    expect(viewSize(820, 1180, 2)).toEqual({ scale: 6, w: 274, h: 394 });
    expect(viewSize(390, 844, 3)).toEqual({ scale: 5, w: 234, h: 507 });
  });

  it('小さな画面でも倍率は 2 より下げない', () => {
    expect(viewSize(200, 300, 1).scale).toBe(2);
  });
});

describe('コマ番号', () => {
  it('負の値でも 0 から n - 1 に入る', () => {
    expect(frameAt(-0.5, 2)).toBe(1);
    expect(frameAt(-3.2, 2)).toBe(0);
    expect(frameAt(5.9, 4)).toBe(1);
  });
});
