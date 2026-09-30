export interface Template {
  id: string;
  name: string;
  /** 100 × 100 の座標の SVG パス。線だけを描き、塗りは使わない */
  d: string;
}

/** 見える線の太さ（100 × 100 の座標で）。塗る場所を分ける白黒の画像は、この 6 割の太さで描いて、塗りの縁を見える線の下に隠す */
export const LINE = 2.4;

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
/** 4 つとがりの星 */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}L${cx + r * 0.3} ${cy - r * 0.3}L${cx + r} ${cy}L${cx + r * 0.3} ${cy + r * 0.3}L${cx} ${cy + r}L${cx - r * 0.3} ${cy + r * 0.3}L${cx - r} ${cy}L${cx - r * 0.3} ${cy - r * 0.3}Z`;
/** 中心 (cx, cy) から dist 離れたところに、n 枚の丸い花びらを並べる */
const petals = (cx: number, cy: number, n: number, dist: number, r: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return circle(+(cx + Math.cos(a) * dist).toFixed(1), +(cy + Math.sin(a) * dist).toFixed(1), r);
  }).join('');

export const TEMPLATES: Template[] = [
  {
    id: 'apple',
    name: 'りんご',
    d:
      'M50 28C38 18 14 22 14 50C14 76 34 94 50 86C66 94 86 76 86 50C86 22 62 18 50 28Z' +
      'M50 28C49 20 51 12 55 6' +
      'M53 17C60 6 74 5 80 11C73 20 62 22 53 17Z' +
      'M24 44C24 36 30 31 36 30C33 36 30 41 24 44Z' +
      'M13.5 62C24 56 36 68 50 62C64 56 76 68 86.5 62'
  },
  {
    id: 'house',
    name: 'おうち',
    d:
      'M20 48L80 48L80 90L20 90Z' +
      'M12 50L50 16L88 50Z' +
      'M66 32L66 20L74 20L74 39' +
      circle(50, 36, 5) +
      'M42 92L42 66C42 59 58 59 58 66L58 92' +
      'M26 58L36 58L36 70L26 70ZM31 58L31 70M26 64L36 64' +
      'M64 58L74 58L74 70L64 70ZM69 58L69 70M64 64L74 64' +
      'M4 90L96 90'
  },
  {
    id: 'fish',
    name: 'さかな',
    d:
      'M18 50C30 26 62 22 78 50C62 78 30 74 18 50Z' +
      'M76 50L94 34L90 50L94 66Z' +
      circle(32, 46, 4) +
      'M41 31C49 40 49 60 41 69' +
      'M54 28.5C60 40 60 60 54 71.5' +
      'M64 32C69 42 69 58 64 68' +
      circle(12, 30, 3) +
      circle(8, 19, 2)
  },
  {
    id: 'cat',
    name: 'ねこ',
    d:
      'M20 56C20 34 34 26 50 26C66 26 80 34 80 56C80 76 66 86 50 86C34 86 20 76 20 56Z' +
      'M22 40L22 10L44 28Z' +
      'M78 40L78 10L56 28Z' +
      ellipse(38, 52, 4, 6) +
      ellipse(62, 52, 4, 6) +
      'M46 62L54 62L50 67Z' +
      'M50 67C50 72 44 74 42 71M50 67C50 72 56 74 58 71' +
      'M8 62L32 64M8 70L32 68M92 62L68 64M92 70L68 68'
  },
  {
    id: 'rocket',
    name: 'ロケット',
    d:
      'M50 6C66 20 68 50 64 76L36 76C32 50 34 20 50 6Z' +
      circle(50, 40, 8) +
      'M36 25C44 19 56 19 64 25' +
      'M37 56L22 82L38 76Z' +
      'M63 56L78 82L62 76Z' +
      'M40 76C40 88 46 92 50 98C54 92 60 88 60 76' +
      'M45 76C45 84 48 88 50 92C52 88 55 84 55 76' +
      sparkle(14, 28, 8) +
      sparkle(86, 50, 6)
  },
  {
    id: 'butterfly',
    name: 'ちょうちょ',
    d:
      'M47 30C47 24 53 24 53 30L53 76C53 82 47 82 47 76Z' +
      circle(50, 22, 5) +
      'M48 18C44 10 40 8 36 8M52 18C56 10 60 8 64 8' +
      'M47 36C30 14 6 18 10 40C12 54 34 54 47 48Z' +
      'M53 36C70 14 94 18 90 40C88 54 66 54 53 48Z' +
      'M47 52C30 54 14 64 20 78C26 90 42 80 47 66Z' +
      'M53 52C70 54 86 64 80 78C74 90 58 80 53 66Z' +
      circle(26, 36, 6) +
      circle(74, 36, 6) +
      circle(32, 70, 4) +
      circle(68, 70, 4)
  },
  {
    id: 'car',
    name: 'くるま',
    d:
      'M8 70L8 56C8 50 12 48 18 48L28 48L38 32L66 32L78 48L88 48C92 48 94 52 94 58L94 70Z' +
      'M36 47L42 36L50 36L50 47Z' +
      'M54 36L64 36L72 47L54 47Z' +
      'M52 46L52 72' +
      circle(26, 72, 10) +
      circle(26, 72, 4) +
      circle(76, 72, 10) +
      circle(76, 72, 4) +
      circle(89, 56, 3) +
      'M2 84L98 84'
  },
  {
    id: 'flower',
    name: 'おはな',
    d:
      petals(50, 36, 6, 17, 9) +
      circle(50, 36, 9) +
      'M47 58L47 96M53 58L53 96' +
      'M47 80C36 70 24 72 18 76C26 86 38 86 47 82Z' +
      'M53 72C62 62 74 62 82 66C76 76 64 78 53 74Z' +
      'M4 96L96 96'
  }
];
