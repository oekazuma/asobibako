// 実行: node scripts/make-icon.ts
// 盤面をそのまま縮めたアイコン（上下の陣地・境界線・両者の玉・境界線上の金の玉）を static/ に書く。
// 依存を増やさずに PNG を作るため、パレットなしの RGB を zlib で固めて自前で PNG チャンクを組む。
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

type RGB = [number, number, number];

const P1: RGB = [31, 155, 255];
const P2: RGB = [255, 77, 94];
const GOLD: RGB = [255, 194, 51];
const ZONE_1: RGB = [217, 238, 255];
const ZONE_2: RGB = [255, 224, 227];
const WHITE: RGB = [255, 255, 255];

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf: Buffer) => {
  let r = 0xffffffff;
  for (const b of buf) r = table[(r ^ b) & 255] ^ (r >>> 8);
  return (r ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const pixel = (x: number, y: number, size: number): RGB => {
  const border = size * 0.5;
  const inside = (cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  // 玉は白いふちで囲む（アプリの部品と同じ見た目）
  const ring = size * 0.022;
  const orbs: [number, number, number, RGB][] = [
    [size * 0.5, border, size * 0.13, GOLD],
    [size * 0.3, size * 0.28, size * 0.095, P2],
    [size * 0.7, size * 0.72, size * 0.095, P1]
  ];
  for (const [cx, cy, r, color] of orbs) {
    if (inside(cx, cy, r)) return color;
    if (inside(cx, cy, r + ring)) return WHITE;
  }
  if (Math.abs(y - border) < size * 0.018) return WHITE;
  return y < border ? ZONE_2 : ZONE_1;
};

const png = (size: number, file: string) => {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0))
    ])
  );
  console.log(`wrote ${file}`);
};

png(180, 'static/icon-180.png');
png(192, 'static/icon-192.png');
png(512, 'static/icon-512.png');
