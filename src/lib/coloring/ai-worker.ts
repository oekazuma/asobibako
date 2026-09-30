// 線画のモデルを画面とは別のスレッドで動かす。数秒〜十数秒かかるあいだも、画面が固まらずに「かいています…」を出せる
import * as ort from 'onnxruntime-web/wasm';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { AI_SIZE } from './ai';

ort.env.wasm.wasmPaths = { wasm, mjs };
// 複数のスレッドは cross-origin isolated なページでしか使えず、GitHub Pages はそのためのヘッダを出せない
ort.env.wasm.numThreads = 1;

let session: Promise<ort.InferenceSession> | undefined;

self.onmessage = async (event: MessageEvent<{ id: number; model: string; tensor: Float32Array }>) => {
  const { id, model, tensor } = event.data;
  try {
    session ??= ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    const s = await session;
    const result = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, AI_SIZE, AI_SIZE]) });
    const out = result[s.outputNames[0]].data as Float32Array;
    self.postMessage({ id, out }, { transfer: [out.buffer] });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
