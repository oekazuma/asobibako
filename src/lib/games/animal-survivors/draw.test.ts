import { describe, expect, it } from 'vitest';
import { devicePx, frameAt, viewSize } from './draw';
import { createWorld, step } from './world';

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

describe('カメラの動き', () => {
  it('斜めや速い動物でも、毎フレーム進む画素数の差は 1 画素まで（背景が跳ばない）', () => {
    for (const [id, dir] of [
      ['dog', { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
      ['cat', { x: 1, y: 0 }]
    ] as const) {
      const w = createWorld(id, 1, { w: 274, h: 394 });
      w.weapons = [];
      w.stage = { ...w.stage, waves: [] };
      const steps: number[] = [];
      let last = devicePx(w.player.x, 6);
      for (let i = 0; i < 60; i++) {
        step(w, dir, 1 / 60);
        const now = devicePx(w.player.x, 6);
        steps.push(now - last);
        last = now;
      }
      expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1);
    }
  });
});
