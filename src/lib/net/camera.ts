import jsQR from 'jsqr';

export type Facing = 'user' | 'environment';

export function openCamera(facing: Facing): Promise<MediaStream> {
  // 画面に出た細かい QR を離れて読むので、既定（720p ほど）より細かく撮る
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
}

export function closeCamera(stream: MediaStream | undefined): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/** video に映る QR を読み続け、wanted が true を返したものを 1 回だけ onread に渡す。戻り値で止める */
export function scan(video: HTMLVideoElement, wanted: (text: string) => boolean, onread: (text: string) => void) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const timer = setInterval(() => {
    if (!video.videoWidth) return;
    // 画面越しの細かい QR も読めて、iPad でも 1 回が重くならない大きさに縮める
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const found = jsQR(pixels, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    if (!found || !wanted(found.data)) return;
    clearInterval(timer);
    onread(found.data);
  }, 150);
  return () => clearInterval(timer);
}
