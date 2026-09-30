import { SIZE } from './regions';

/**
 * 写真を SIZE × SIZE に収めた画素にする。切り取らずに収め、余白は白にする。
 * 縦に撮った写真が横倒しにならないよう、向きは写真の情報に従うと明示する（既定が端末の版で違ったため）
 */
export async function readPhoto(file: Blob): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, SIZE, SIZE);
    const s = Math.min(SIZE / bmp.width, SIZE / bmp.height);
    g.drawImage(bmp, (SIZE - bmp.width * s) / 2, (SIZE - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
    return g.getImageData(0, 0, SIZE, SIZE).data;
  } finally {
    // 大きな写真は画素に広げると数百 MB になるので、読み終えたらすぐ放す
    bmp.close();
  }
}
