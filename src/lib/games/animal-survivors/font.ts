/** 3×5 のドット字。1 文字 = 5 行 × 3 ビット */
const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  ':': '000010000010000',
  '.': '000000000000010',
  '/': '001001010100100',
  '+': '000010111010000',
  '-': '000000111000000',
  '%': '101001010100101',
  '*': '010111010101000',
  '!': '010010010000010',
  ' ': '000000000000000'
};

const OUTLINE = '#24151f';
const baked = new Map<string, HTMLCanvasElement>();

/** 1 文字を、1 ドットの黒いふちつきで焼く（幅 3s+2、高さ 5s+2） */
function glyph(ch: string, color: string, s: number) {
  const key = `${ch}|${color}|${s}`;
  let c = baked.get(key);
  if (c) return c;
  const bits = GLYPHS[ch] ?? GLYPHS[' '];
  c = document.createElement('canvas');
  c.width = 3 * s + 2;
  c.height = 5 * s + 2;
  const g = c.getContext('2d')!;
  const on = (x: number, y: number) => bits[y * 3 + x] === '1';
  g.fillStyle = OUTLINE;
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++)
      if (on(x, y))
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1]
        ])
          g.fillRect(1 + x * s + dx, 1 + y * s + dy, s, s);
  g.fillStyle = color;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (on(x, y)) g.fillRect(1 + x * s, 1 + y * s, s, s);
  baked.set(key, c);
  return c;
}

/** (x, y) を左上にして書き、幅を返す。位置は丸めないので、呼ぶ側が描く細かさに合わせて丸めておく */
export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
  size: 1 | 2 = 1
): number {
  const step = 4 * size;
  for (let i = 0; i < s.length; i++) ctx.drawImage(glyph(s[i].toUpperCase(), color, size), x + i * step - 1, y - 1);
  return s.length * step - size;
}

export function textWidth(s: string, size: 1 | 2 = 1): number {
  return s.length * 4 * size - size;
}
