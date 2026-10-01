import { describe, expect, it } from 'vitest';
import { label } from './regions';
import { remap } from './remap';

const N = 20;
const blank = () => new Uint8Array(N * N);
const wall = (m: Uint8Array, x: number) => {
  for (let y = 0; y < N; y++) m[y * N + x] = 1;
  return m;
};

describe('remap', () => {
  // 線を足して 1 つの場所が 2 つに分かれても、どちらにも前の色を残す
  it('分かれた場所は、両方とも前の色を引き継ぐ', () => {
    const before = label(blank(), N, N);
    const after = label(wall(blank(), 10), N, N);
    const colors = remap(before, { [before.labels[0]]: '#f00' }, after, N * N);
    const left = after.labels[5 * N + 2];
    const right = after.labels[5 * N + 15];
    expect(colors).toEqual({ [left]: '#f00', [right]: '#f00' });
  });

  it('つながった場所は、重なりのいちばん多かった色にし、塗っていない場所は塗らない', () => {
    const before = label(wall(blank(), 6), N, N);
    const after = label(blank(), N, N);
    const left = before.labels[5 * N + 2];
    const right = before.labels[5 * N + 15];
    expect(remap(before, { [left]: '#00f', [right]: '#f00' }, after, N * N)).toEqual({ [after.labels[0]]: '#f00' });
    expect(remap(before, {}, after, N * N)).toEqual({});
  });

  // 小さな塗った場所と大きな白い場所の境の線を消しても、白い場所まで染めない
  it('塗っていない画素も数え、塗っていないほうが多ければ塗らない', () => {
    const before = label(wall(blank(), 3), N, N);
    const after = label(blank(), N, N);
    expect(remap(before, { [before.labels[5 * N + 1]]: '#f00' }, after, N * N)).toEqual({});
  });
});
