import { describe, expect, it } from 'vitest';
import { toBoardPoint } from './board-input';

describe('toBoardPoint', () => {
  const box = { left: 0, top: 0, right: 1024, width: 1024, height: 768 };

  it('回していなければ画面の左上が盤面の左上', () => {
    expect(toBoardPoint(0, 0, box, false)).toEqual([0, 0]);
    expect(toBoardPoint(1024, 768, box, false)).toEqual([1, 1]);
  });

  it('時計回りに 90 度回していれば、画面の右上が盤面の左上、画面の左下が盤面の右下', () => {
    expect(toBoardPoint(1024, 0, box, true)).toEqual([0, 0]);
    expect(toBoardPoint(0, 768, box, true)).toEqual([1, 1]);
    // 盤面の上半分（向かいのプレイヤー）は画面の右半分、下半分（手前）は左半分
    expect(toBoardPoint(900, 384, box, true)[1]).toBeLessThan(0.5);
    expect(toBoardPoint(100, 384, box, true)[1]).toBeGreaterThan(0.5);
  });
});
