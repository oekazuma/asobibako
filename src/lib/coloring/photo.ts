import type { Crop } from './crop';
import { SIZE } from './regions';

/** 縦に撮った写真が横倒しにならないよう、向きは写真の情報に従うと明示する（既定が端末の版で違ったため） */
export function openPhoto(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** 写真の切り取る正方形を SIZE × SIZE の画素にする。写真からはみ出したところは白 */
export function cropPixels(bmp: ImageBitmap, crop: Crop): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, SIZE, SIZE);
  g.drawImage(bmp, crop.x, crop.y, crop.size, crop.size, 0, 0, SIZE, SIZE);
  return g.getImageData(0, 0, SIZE, SIZE).data;
}
