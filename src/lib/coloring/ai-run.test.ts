import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ asset: (path: string) => path }));

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  sent: { id: number }[] = [];
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage(data: { id: number }) {
    this.sent.push(data);
  }
  terminate() {
    this.terminated = true;
  }
}
vi.stubGlobal('Worker', FakeWorker);

const { drawWithAi, stopAi } = await import('./ai-run');

describe('drawWithAi', () => {
  afterEach(() => {
    stopAi();
    FakeWorker.made = [];
  });

  it('ワーカーの出力を返す', async () => {
    const drawing = drawWithAi(new Float32Array(1));
    const w = FakeWorker.made[0];
    const out = new Float32Array([0.5]);
    w.onmessage!({ data: { id: w.sent[0].id, out } });
    expect(await drawing).toBe(out);
  });

  // onnxruntime はワーカーの中で読みこみの失敗を覚えるので、同じワーカーでは何度押しても描けない
  it('しくじったらワーカーを捨て、次は新しいワーカーで描く', async () => {
    const drawing = drawWithAi(new Float32Array(1));
    const w = FakeWorker.made[0];
    w.onmessage!({ data: { id: w.sent[0].id, error: 'no wasm' } });
    await expect(drawing).rejects.toThrow('no wasm');
    expect(w.terminated).toBe(true);
    void drawWithAi(new Float32Array(1)).catch(() => {});
    expect(FakeWorker.made).toHaveLength(2);
  });

  // ワーカーのファイルが読めない（はじめてをオフラインで押した・古い版のファイルが消えた）と、返事が来ずに待ち続ける
  it('ワーカーが動かなかったら、待っている呼び出しを失敗にする', async () => {
    const drawing = drawWithAi(new Float32Array(1));
    FakeWorker.made[0].onerror!();
    await expect(drawing).rejects.toThrow();
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it('止めたら、待っている呼び出しを失敗にしてワーカーを捨てる', async () => {
    const drawing = drawWithAi(new Float32Array(1));
    stopAi();
    await expect(drawing).rejects.toThrow();
    expect(FakeWorker.made[0].terminated).toBe(true);
  });
});
