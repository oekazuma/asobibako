/**
 * deflate-raw を戻す。戻すのは先頭の max バイトまでで、そこで読むのをやめる。
 * 相手の端末や QR から来るデータは、小さくても 1000 倍ほどに膨らむことがあるので、要る大きさより先を確保しない
 */
export async function inflate(bytes: Uint8Array<ArrayBuffer>, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const out = new Uint8Array(max);
  let length = 0;
  while (length < max) {
    const { done, value } = await reader.read();
    if (done) return out.slice(0, length);
    const n = Math.min(value.length, max - length);
    out.set(value.subarray(0, n), length);
    length += n;
  }
  await reader.cancel();
  return out;
}
