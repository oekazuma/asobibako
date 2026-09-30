import { pack, unpack } from './book';

/** DataChannel の 1 通に収めるため、1 ビットに詰めた線画をさらに縮めて base64 にする */
export async function encodeLines(mask: Uint8Array): Promise<string> {
  const stream = new Blob([new Uint8Array(pack(mask))]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let text = '';
  // 大きな配列を String.fromCharCode(...) に広げると引数の上限を超えるので、少しずつつなぐ
  for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(text);
}

export async function decodeLines(text: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return unpack(new Uint8Array(await new Response(stream).arrayBuffer()));
}
