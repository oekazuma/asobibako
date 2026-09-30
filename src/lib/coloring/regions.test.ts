import { describe, expect, it } from 'vitest';
import { hideCovered, label, regionAt } from './regions';

/** 8 × 8 の画像に、(2,2)〜(5,5) の四角い線を描く */
function ring(): Uint8Array {
  const m = new Uint8Array(64);
  for (let i = 2; i <= 5; i++) m[2 * 8 + i] = m[5 * 8 + i] = m[i * 8 + 2] = m[i * 8 + 5] = 1;
  return m;
}

describe('label', () => {
  it('線で囲んだ内側と外側が別の場所になり、線の画素には番号が付かない', () => {
    const r = label(ring(), 8, 8);
    expect(r.count).toBe(2);
    expect(r.labels[0]).not.toBe(r.labels[3 * 8 + 3]);
    expect(r.labels[3 * 8 + 3]).toBe(r.labels[4 * 8 + 4]);
    expect(r.labels[2 * 8 + 2]).toBe(-1);
  });

  it('囲みが途切れていれば 1 つの場所になる', () => {
    const m = ring();
    m[2 * 8 + 3] = 0;
    expect(label(m, 8, 8).count).toBe(1);
  });

  it('斜めにしかつながっていない画素は別の場所にする（線の角から塗りがもれない）', () => {
    const m = new Uint8Array([0, 1, 1, 0]);
    expect(label(m, 2, 2).count).toBe(2);
  });
});

describe('regionAt', () => {
  it('線でない画素はその場所、線の上は近くの場所を返す', () => {
    const r = label(ring(), 8, 8);
    expect(regionAt(r, 3, 3, 8, 8)).toBe(r.labels[3 * 8 + 3]);
    expect(regionAt(r, 2, 3, 8, 8)).toBeGreaterThanOrEqual(0);
  });

  it('近くに線でない画素が無ければ -1', () => {
    const r = label(new Uint8Array(64).fill(1), 8, 8);
    expect(regionAt(r, 4, 4, 8, 8, 2)).toBe(-1);
  });

  it('盤面の外は -1', () => {
    const r = label(ring(), 8, 8);
    expect(regionAt(r, -5, 3, 8, 8, 1)).toBe(-1);
  });
});

describe('隠れた場所', () => {
  // 太い線の中に閉じこめられた場所は、見えている線の下に隠れている。押しても何も変わらないので、近くの見える場所を塗る
  it('見える線の下に隠れた場所は押しても選ばず、近くの見える場所を返す', () => {
    const w = 40;
    const m = new Uint8Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 15; x < 25; x++) m[y * w + x] = 1;
    for (let y = 18; y < 23; y++) for (let x = 18; x < 23; x++) m[y * w + x] = 0;
    const cover = new Uint8Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 14; x < 26; x++) cover[y * w + x] = 1;
    const r = hideCovered(label(m, w, w), cover);
    const pocket = r.labels[20 * w + 20];
    expect(pocket).toBeGreaterThanOrEqual(0);
    const hit = regionAt(r, 20, 20, w, w);
    expect(hit).not.toBe(pocket);
    expect(hit).toBeGreaterThanOrEqual(0);
  });

  it('小さくても見えている場所は、そのまま選べる（写真の目の光など）', () => {
    const w = 20;
    const m = new Uint8Array(w * w).fill(1);
    m[10 * w + 10] = 0;
    const r = label(m, w, w);
    expect(regionAt(r, 10, 10, w, w)).toBe(r.labels[10 * w + 10]);
  });

  it('隠れた場所を印しても、場所の番号は変わらない', () => {
    const m = new Uint8Array(64);
    for (let i = 2; i <= 5; i++) m[2 * 8 + i] = m[5 * 8 + i] = m[i * 8 + 2] = m[i * 8 + 5] = 1;
    const before = label(m, 8, 8);
    const after = hideCovered(label(m, 8, 8), new Uint8Array(64));
    expect([...after.labels]).toEqual([...before.labels]);
  });
});
