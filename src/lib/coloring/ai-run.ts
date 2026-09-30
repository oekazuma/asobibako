import { asset } from '$app/paths';

let worker: Worker | undefined;
let next = 0;
const waiting = new Map<number, { resolve: (out: Float32Array) => void; reject: (error: Error) => void }>();

/** モデルに toTensor() の入力を渡し、出力（AI_SIZE × AI_SIZE、1 が白）を受け取る。初めての呼び出しでモデルを読みこむ */
export function drawWithAi(tensor: Float32Array): Promise<Float32Array> {
  if (!worker) {
    worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; out?: Float32Array; error?: string }>) => {
      const { id, out, error } = event.data;
      const wait = waiting.get(id);
      waiting.delete(id);
      if (out) wait?.resolve(out);
      else wait?.reject(new Error(error));
    };
  }
  const id = ++next;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker!.postMessage({ id, model: asset('/ai/line-drawings.onnx'), tensor }, [tensor.buffer]);
  });
}
