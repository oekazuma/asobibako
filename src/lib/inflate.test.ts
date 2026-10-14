import { describe, expect, it } from 'vitest';
import { inflate } from './inflate';

const deflate = async (data: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
  );

describe('inflate', () => {
  it('上限より小さいデータは、そのまま戻す', async () => {
    const data = new TextEncoder().encode('あいうえお'.repeat(100));
    expect(await inflate(await deflate(data), 16 * 1024)).toEqual(data);
  });

  it('大きく膨らむデータは、上限のバイトで打ち切る', async () => {
    const bomb = await deflate(new Uint8Array(8 * 1024 * 1024).fill(7));
    expect(bomb.length).toBeLessThan(64 * 1024);
    const out = await inflate(bomb, 1024);
    expect(out).toHaveLength(1024);
    expect(out.every((b) => b === 7)).toBe(true);
  });

  it('形の壊れたデータは reject する', async () => {
    await expect(inflate(new Uint8Array([1, 2, 3, 255, 255]), 100)).rejects.toThrow();
  });
});
