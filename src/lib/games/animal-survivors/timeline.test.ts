import { describe, expect, it } from 'vitest';
import { Timeline } from './timeline';

describe('Timeline', () => {
  it('届く時刻がばらついても、送った時刻どおりの等しい間でつなぐ', () => {
    const line = new Timeline<number>();
    // 50ms ごとに送った値 0, 1, 2, … が、0〜40ms のむらで届く
    const jitter = [0, 30, 5, 40, 10, 0, 35, 20];
    jitter.forEach((j, i) => line.push(i * 50, 1000 + i * 50 + j, i));
    const xs = [];
    for (let now = 1300; now <= 1400; now += 25) {
      const s = line.at(now, 100)!;
      xs.push(s.a + (s.b - s.a) * s.t);
    }
    // 送った時刻で見ると、25ms ごとに 0.5 ずつ進む
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(0.5);
  });

  it('まだ 1 つしか無いときや、遅れて先の値が無いときは、いちばん新しい値をそのまま返す', () => {
    const line = new Timeline<number>();
    expect(line.at(0, 100)).toBeNull();
    line.push(0, 1000, 7);
    expect(line.at(1500, 100)).toEqual({ a: 7, b: 7, t: 0 });
    line.push(50, 1050, 8);
    expect(line.at(5000, 100)).toEqual({ a: 8, b: 8, t: 0 });
  });
});
