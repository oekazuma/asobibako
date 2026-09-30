import { asset } from '$app/paths';

let worker: Worker | undefined;
let next = 0;
const waiting = new Map<number, { resolve: (out: Float32Array) => void; reject: (error: Error) => void }>();

/**
 * ワーカーを捨て、待っている呼び出しを失敗にする。onnxruntime はワーカーの中で読みこみの失敗を覚えていて、
 * 同じワーカーでは描き直せないので、しくじったら次は新しいワーカーで始める
 */
function reset(error: Error) {
  worker?.terminate();
  worker = undefined;
  for (const wait of waiting.values()) wait.reject(error);
  waiting.clear();
}

/** 描いている途中でも止め、モデルと実行部分が抱える大きなメモリを手放す */
export function stopAi() {
  reset(new Error('stopped'));
}

/** モデルに toTensor() の入力を渡し、出力（AI_SIZE × AI_SIZE、1 が白）を受け取る。初めての呼び出しでモデルを読みこむ */
export function drawWithAi(tensor: Float32Array): Promise<Float32Array> {
  if (!worker) {
    worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; out?: Float32Array; error?: string }>) => {
      const { id, out, error } = event.data;
      if (!out) return reset(new Error(error));
      waiting.get(id)?.resolve(out);
      waiting.delete(id);
    };
    // ワーカーのファイルが読めない（はじめてをオフラインで押した・古い版のファイルが消えた）と返事が来ない
    worker.onerror = () => reset(new Error('worker failed'));
  }
  const id = ++next;
  const w = worker;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, model: asset('/ai/line-drawings.onnx'), tensor }, [tensor.buffer]);
  });
}
