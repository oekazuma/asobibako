export const GRAPHICS_KEY = 'asobibako:graphics';

/** 3D の画質。端末の力に合わせて選ぶ（毛の枚数・影・画面の細かさを変える） */
export type Quality = 'high' | 'normal' | 'low';

export const QUALITIES: { id: Quality; name: string; note: string }[] = [
  { id: 'high', name: 'きれい', note: 'けが ふさふさ。いちばん きれい' },
  { id: 'normal', name: 'ふつう', note: 'きれいさと かるさの まんなか' },
  { id: 'low', name: 'かるい', note: 'うごきが かくかく するときに' }
];

export const graphics = $state({ quality: read() });

function read(): Quality {
  try {
    const v = localStorage.getItem(GRAPHICS_KEY);
    // 遊ぶ端末（iPad Air 2025）はいちばん上の画質で動くので、選ばれていなければ high
    return v === 'normal' || v === 'low' ? v : 'high';
  } catch {
    return 'high';
  }
}

export function setQuality(quality: Quality): void {
  graphics.quality = quality;
  try {
    localStorage.setItem(GRAPHICS_KEY, quality);
  } catch {
    // プライベートブラウズでは覚えられないが、いまの画面には効く
  }
}
