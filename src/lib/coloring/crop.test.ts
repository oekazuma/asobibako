import { describe, expect, it } from 'vitest';
import { clampCrop, initialCrop, panCrop, zoomCrop } from './crop';

describe('initialCrop', () => {
  it('はじめは写真の全体が入る正方形（長い辺に合わせ、はみ出す側は白になる）', () => {
    expect(initialCrop(400, 200)).toEqual({ x: 0, y: -100, size: 400 });
  });
});

describe('zoomCrop', () => {
  it('真ん中を保ったまま、倍率のぶんだけ正方形を小さくする', () => {
    expect(zoomCrop({ x: 0, y: -100, size: 400 }, 2, 400, 200)).toEqual({ x: 100, y: 0, size: 200 });
  });

  it('倍率 1 より小さくはしない', () => {
    expect(zoomCrop({ x: 100, y: 0, size: 200 }, 0.5, 400, 200)).toEqual({ x: 0, y: -100, size: 400 });
  });
});

describe('panCrop', () => {
  it('指を動かした向きに写真が動く（正方形は逆に動く）', () => {
    expect(panCrop({ x: 100, y: 0, size: 200 }, 30, 0, 400, 200)).toEqual({ x: 70, y: 0, size: 200 });
  });

  it('写真の外へは出さない', () => {
    expect(panCrop({ x: 100, y: 0, size: 200 }, 500, 0, 400, 200)).toEqual({ x: 0, y: 0, size: 200 });
    expect(panCrop({ x: 100, y: 0, size: 200 }, -500, 0, 400, 200)).toEqual({ x: 200, y: 0, size: 200 });
  });
});

describe('clampCrop', () => {
  it('写真より大きい向きは、真ん中にそろえる', () => {
    expect(clampCrop({ x: 30, y: 50, size: 400 }, 400, 200)).toEqual({ x: 0, y: -100, size: 400 });
  });
});
