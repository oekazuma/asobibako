export type RGB = [number, number, number];

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function toHex(c: RGB): string {
  return (
    '#' +
    c
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

export function fromHex(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const same = (a: RGB, b: RGB) => a.every((v, i) => Math.abs(v - b[i]) < 0.5 / 255);

export function pushRecent(list: RGB[], c: RGB): RGB[] {
  // 呼び出し側の配列（塗りの記録が持つ色）を共有しない
  return [[...c], ...list.filter((x) => !same(x, c))].slice(0, 8) as RGB[];
}

/** 本家のパレットの見本の格子（14 色 × 3 段）。1 段めは白黒と木と金、2 段めは強い色、3 段めは淡い色と屋敷の壁紙の色 */
export const SWATCHES = [
  '#ffffff',
  '#e6e6e6',
  '#bdbdbd',
  '#8f8f8f',
  '#5e5e5e',
  '#333333',
  '#111111',
  '#5a3a22',
  '#8b5a2b',
  '#c08a4a',
  '#e8c89a',
  '#f3e6c8',
  '#d4af37',
  '#b87333',
  '#c62828',
  '#e65100',
  '#f9a825',
  '#fdd835',
  '#7cb342',
  '#2e7d32',
  '#00897b',
  '#00acc1',
  '#1e88e5',
  '#283593',
  '#5e35b1',
  '#8e24aa',
  '#d81b60',
  '#f06292',
  '#f8bbd0',
  '#ffccbc',
  '#ffe0b2',
  '#fff9c4',
  '#dcedc8',
  '#a5d6a7',
  '#80cbc4',
  '#b2ebf2',
  '#bbdefb',
  '#c5cae9',
  '#d1c4e9',
  '#3e5b3a',
  '#2f4f6f',
  '#7a1f2b'
];
