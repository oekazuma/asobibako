import { describe, expect, it } from 'vitest';
import { SIZE } from './regions';
import { decodeLines, encodeLines } from './wire';

/** テンプレートくらいの線画。太さ 11 画素の円を 3 つ描く */
function rings(): Uint8Array {
  const mask = new Uint8Array(SIZE * SIZE);
  for (const [cx, cy, r] of [
    [384, 384, 300],
    [300, 300, 60],
    [470, 300, 60]
  ]) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (Math.abs(Math.hypot(x - cx, y - cy) - r) < 5.5) mask[y * SIZE + x] = 1;
      }
    }
  }
  return mask;
}

describe('encodeLines と decodeLines', () => {
  it('線画を縮めて base64 にし、元に戻せる', async () => {
    const mask = rings();
    const text = await encodeLines(mask);
    expect(text).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(await decodeLines(text)).toEqual(mask);
  });

  it('テンプレートくらいの線画は 16 KB より小さい', async () => {
    expect((await encodeLines(rings())).length).toBeLessThan(16 * 1024);
  });

  it('線画より大きく膨らむデータは、線画の大きさで打ち切って戻す', async () => {
    const huge = new Uint8Array(8 * 1024 * 1024).fill(255);
    const packed = new Uint8Array(
      await new Response(new Blob([huge]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
    );
    expect(packed.length).toBeLessThan(60000);
    const mask = await decodeLines(btoa(String.fromCharCode(...packed)));
    expect(mask).toHaveLength(SIZE * SIZE);
    expect(mask.every((v) => v === 1)).toBe(true);
  });
});
