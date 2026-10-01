import { describe, expect, it } from 'vitest';
import { closeGaps } from './gaps';
import { label } from './regions';

const N = 120;

function blank() {
  return new Uint8Array(N * N);
}

/** 太さ 3 の線を (x0, y0) から (x1, y1) へ描く */
function line(m: Uint8Array, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m[(y + dy) * N + x + dx] = 1;
  }
}

/** 四角の輪。上の辺だけ gap 画素あける */
function ring(gap: number) {
  const m = blank();
  const mid = N / 2;
  line(m, 20, 20, mid - gap / 2 - 2, 20);
  line(m, mid + gap / 2 + 2, 20, 100, 20);
  line(m, 100, 20, 100, 100);
  line(m, 100, 100, 20, 100);
  line(m, 20, 100, 20, 20);
  return m;
}

const split = (m: Uint8Array) => {
  const r = label(m, N, N);
  return r.labels[60 * N + 60] !== r.labels[5 * N + 5];
};

describe('closeGaps', () => {
  it('線の端どうしの少しのすき間をつなぎ、内と外を分ける', () => {
    const m = ring(10);
    expect(split(m)).toBe(false);
    expect(split(closeGaps(m, N, N, 16))).toBe(true);
  });

  it('届かないほど広いすき間はつながない', () => {
    expect(split(closeGaps(ring(40), N, N, 16))).toBe(false);
  });

  // 並んだ線どうしを横につなぐと、塗りたい細い場所がつぶれる
  it('並んだ 2 本の線は、横どうしではつながない', () => {
    const m = blank();
    line(m, 20, 50, 90, 50);
    line(m, 20, 62, 90, 62);
    expect([...closeGaps(m, N, N, 16)]).toEqual([...m]);
  });

  it('もとの線は消さない', () => {
    const m = ring(10);
    const out = closeGaps(m, N, N, 16);
    for (let i = 0; i < m.length; i++) if (m[i]) expect(out[i]).toBe(1);
  });
});
