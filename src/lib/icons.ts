/**
 * 絵文字の代わりに使う自前のアイコン。24 × 24 の座標の SVG パスを重ねて描く。
 * DOM では Icon.svelte が <svg> に、canvas では fx.ts の icon() が Path2D にして同じ絵を出す
 */
export interface Layer {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
}

const INK = '#2b2d42';
const SKIN = '#ffd7b5';
/** はいしゃさんの道具・歯・バイキンのふち線 */
const LINE = '#5b4a42';
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0z`;
const finger = (x: number, top: number) => `M${x} ${top + 1.5}a1.5 1.5 0 0 1 3 0V14h-3z`;
/** ヒツジのもこもこの毛。重なった丸 */
const WOOL =
  circle(7, 8.5, 3.3) + circle(12, 6.2, 3.6) + circle(17, 8.5, 3.3) + circle(5.8, 13, 3) + circle(18.2, 13, 3);
const palm = 'M6.5 12.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z';

/** ななめ上から見た首輪。ふち線の太い輪に色の細い輪を重ね、白い縫い目の点線を入れる */
const collar = (color: string): Layer[] => [
  { d: ellipse(12, 9.5, 8.5, 4.2), stroke: LINE, width: 4.4 },
  { d: ellipse(12, 9.5, 8.5, 4.2), stroke: color, width: 2.6 },
  { d: 'M6 12.3l1.2.4M9.2 13.4l1.4.2M13.4 13.6l1.4-.2M16.8 12.7l1.2-.4', stroke: '#fff4dc', width: 0.8 },
  { d: 'M12 13.8v1.4', stroke: LINE, width: 1.2 }
];
const BONE =
  circle(8.2, 17.4, 1.5) +
  circle(8.2, 19.8, 1.5) +
  circle(15.8, 17.4, 1.5) +
  circle(15.8, 19.8, 1.5) +
  'M8.2 17.2h7.6v2.8H8.2z';

/** 表情を重ねる前の、男の子と犬の顔 */
const KID: Layer[] = [
  { d: circle(12, 12.5, 8.5), fill: SKIN },
  { d: 'M3.5 12c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5c-2-2.6-4.5-3.6-8.5-3.6S5.5 9.4 3.5 12z', fill: '#8a5a3b' },
  { d: circle(7, 15.5, 1.2) + circle(17, 15.5, 1.2), fill: '#ff9aa8' }
];
const DOG: Layer[] = [
  { d: ellipse(5.5, 10, 3, 5.5) + ellipse(18.5, 10, 3, 5.5), fill: '#8a5a3b' },
  { d: circle(12, 13, 8), fill: '#f2d2a9' },
  { d: ellipse(12, 16.5, 4, 3), fill: '#fff' },
  { d: ellipse(12, 14.8, 1.8, 1.3), fill: INK },
  { d: 'M12 16.2v1.5M10.5 18a1.5 1.5 0 0 0 1.5-.3 1.5 1.5 0 0 0 1.5.3', stroke: INK, width: 0.8 }
];

const CAT: Layer[] = [
  { d: 'M4.5 11L5 3.5l6 3.5zM19.5 11L19 3.5l-6 3.5z', fill: '#ffb766' },
  { d: 'M6 9.5l.3-4 3.2 2zM18 9.5l-.3-4-3.2 2z', fill: '#ff9aa8' },
  { d: circle(12, 13, 8), fill: '#ffc98a' },
  { d: 'M12 5.3v2.6M9.3 5.8l.8 2.2M14.7 5.8l-.8 2.2', stroke: '#e8893a', width: 1 },
  { d: 'M10.8 14.6h2.4L12 16z', fill: '#ff7a8f' },
  { d: 'M10.2 17a1.8 1.8 0 0 0 1.8-1 1.8 1.8 0 0 0 1.8 1', stroke: INK, width: 0.8 },
  { d: 'M2.5 14.2l4.5.6M2.8 17l4.3-.9M21.5 14.2l-4.5.6M21.2 17l-4.3-.9', stroke: INK, width: 0.5 }
];

/** 主人公の探偵。鹿撃ち帽とケープ。表情だけ重ねて変える */
const DETECTIVE: Layer[] = [
  { d: 'M3.5 23.5c.8-3.6 4-5.5 8.5-5.5s7.7 1.9 8.5 5.5z', fill: '#9c7a5c', stroke: LINE, width: 1.2 },
  { d: 'M8.2 18.6L12 21.4l3.8-2.8', stroke: LINE, width: 1 },
  { d: circle(12, 12.6, 6.3), fill: SKIN, stroke: LINE, width: 1.2 },
  { d: 'M5.2 11.2c0-4.6 3-7.4 6.8-7.4s6.8 2.8 6.8 7.4z', fill: '#d8b48a', stroke: LINE, width: 1.2 },
  { d: 'M8.4 5.2v6M12 3.8v7.4M15.6 5.2v6M5.6 8.4h12.8', stroke: '#b08a62', width: 0.7 },
  { d: 'M4.6 11.2h14.8l-1.6 1.5H6.2z', fill: '#b08a62', stroke: LINE, width: 1 },
  { d: circle(12, 3.6, 0.9), fill: '#8a5a3b' },
  { d: circle(8.4, 15.6, 1) + circle(15.6, 15.6, 1), fill: '#ff9aa8' }
];

export const ICONS = {
  coin: [
    { d: circle(12, 12, 10), fill: '#e39a00' },
    { d: circle(12, 12, 8), fill: '#ffc233' },
    { d: 'M12 6.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z', fill: '#e39a00' }
  ],
  star: [
    {
      d: 'M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z',
      fill: '#ffc233',
      stroke: '#fff',
      width: 1.2
    },
    { d: 'M12 5.5l1.6 3.4 3.5.5', stroke: '#fff3a0', width: 1.4 }
  ],
  bolt: [{ d: 'M13.5 1.5L4 13.5h6.5l-1.5 9 9.5-12.5h-6.5z', fill: '#ffc233', stroke: '#e39a00', width: 1 }],
  tap: [
    { d: 'M12 6.5a5 5 0 0 0-5 5M12 3a8.5 8.5 0 0 0-8.5 8.5', stroke: '#1f9bff', width: 1.4 },
    { d: finger(10.5, 5), fill: SKIN, stroke: '#c98b5e', width: 0.8 },
    { d: palm, fill: SKIN, stroke: '#c98b5e', width: 0.8 }
  ],
  hold: [
    { d: 'M12 2a10 10 0 1 1-10 10', stroke: '#ff4d5e', width: 2 },
    { d: finger(10.5, 5), fill: SKIN, stroke: '#c98b5e', width: 0.8 },
    { d: palm, fill: SKIN, stroke: '#c98b5e', width: 0.8 }
  ],
  two: [
    { d: finger(8, 3), fill: SKIN, stroke: '#c98b5e', width: 0.8 },
    { d: finger(13, 3), fill: SKIN, stroke: '#c98b5e', width: 0.8 },
    { d: palm, fill: SKIN, stroke: '#c98b5e', width: 0.8 }
  ],
  arrow: [{ d: 'M12 2.5l8 9h-5v10h-6v-10H4z', fill: '#1f9bff', stroke: '#fff', width: 1.2 }],
  skull: [
    {
      d: 'M12 2c5.2 0 8.8 3.7 8.8 8.5 0 2.8-1.3 4.6-3 5.6V19a1.5 1.5 0 0 1-1.5 1.5H7.7A1.5 1.5 0 0 1 6.2 19v-2.9c-1.7-1-3-2.8-3-5.6C3.2 5.7 6.8 2 12 2z',
      fill: '#f4f5fa'
    },
    { d: circle(8.6, 11, 2.3) + circle(15.4, 11, 2.3), fill: INK },
    { d: 'M12 13.8l1.2 2.2h-2.4z', fill: INK },
    { d: 'M9.5 17.5v3M12 17.5v3M14.5 17.5v3', stroke: INK, width: 0.9 }
  ],
  speaker: [
    { d: 'M3 9h4l5.5-4.5v15L7 15H3z', fill: INK },
    { d: 'M15.5 8.5a5 5 0 0 1 0 7M18.3 5.7a9 9 0 0 1 0 12.6', stroke: INK, width: 1.8 }
  ],
  mute: [
    { d: 'M3 9h4l5.5-4.5v15L7 15H3z', fill: INK },
    { d: 'M15.5 9l6 6M21.5 9l-6 6', stroke: '#ff4d5e', width: 2 }
  ],
  sad: [
    { d: circle(12, 12, 10), fill: '#ffd166' },
    { d: circle(8.5, 10, 1.3) + circle(15.5, 10, 1.3), fill: INK },
    { d: 'M8 17a5 5 0 0 1 8 0', stroke: INK, width: 1.6 },
    { d: 'M6.8 12.5c-.8 1.4-1.3 2.3-1.3 3a1.3 1.3 0 0 0 2.6 0c0-.7-.5-1.6-1.3-3z', fill: '#4db5ff' }
  ],
  undo: [{ d: 'M5 10h9.5a5 5 0 0 1 0 10H10M9 5.5L4.5 10 9 14.5', stroke: INK, width: 2.4 }],
  pencil: [
    { d: 'M5 16.5L15.5 6l2.5 2.5L7.5 19H5z', fill: '#ffc233', stroke: '#e39a00', width: 0.8 },
    { d: 'M5 16.5V19h2.5z', fill: INK },
    { d: 'M15.5 6l1.8-1.8a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L18 8.5z', fill: '#ff8fa3' }
  ],
  bee: [
    { d: ellipse(9, 7, 3.5, 4.5) + ellipse(15, 7, 3.5, 4.5), fill: '#dcefff', stroke: '#9fb6cc', width: 0.8 },
    { d: ellipse(12, 14, 7, 5.5), fill: '#ffc233', stroke: INK, width: 0.8 },
    { d: 'M9.5 9v10M13.5 9v10', stroke: INK, width: 2 },
    { d: circle(17, 13, 1), fill: INK }
  ],
  dog: [...DOG, { d: circle(9, 11.5, 1.3) + circle(15, 11.5, 1.3), fill: INK }],
  'dog-happy': [...DOG, { d: 'M7.8 12a1.4 1.4 0 0 1 2.4 0M13.8 12a1.4 1.4 0 0 1 2.4 0', stroke: INK, width: 1.2 }],
  'dog-hurt': [
    ...DOG,
    { d: 'M7.8 10.3l2.4 2.4M10.2 10.3l-2.4 2.4M13.8 10.3l2.4 2.4M16.2 10.3l-2.4 2.4', stroke: INK, width: 1.1 }
  ],
  'dog-scared': [
    ...DOG,
    { d: 'M7.6 11.5l2.2-1.1M16.4 11.5l-2.2-1.1', stroke: INK, width: 1 },
    { d: 'M7.8 12.8a1.4 1.4 0 0 0 2.4 0M13.8 12.8a1.4 1.4 0 0 0 2.4 0', stroke: INK, width: 1.2 },
    {
      d: 'M8.3 14.2c-.7 1.3-1.1 2.1-1.1 2.7a1.1 1.1 0 0 0 2.2 0c0-.6-.4-1.4-1.1-2.7zM15.7 14.2c-.7 1.3-1.1 2.1-1.1 2.7a1.1 1.1 0 0 0 2.2 0c0-.6-.4-1.4-1.1-2.7z',
      fill: '#4db5ff'
    }
  ],
  cat: [...CAT, { d: circle(9, 11.8, 1.3) + circle(15, 11.8, 1.3), fill: INK }],
  'cat-scared': [
    ...CAT,
    { d: 'M7.6 11.6l2.2-1.1M16.4 11.6l-2.2-1.1', stroke: INK, width: 1 },
    { d: 'M7.8 12.9a1.4 1.4 0 0 0 2.4 0M13.8 12.9a1.4 1.4 0 0 0 2.4 0', stroke: INK, width: 1.2 },
    {
      d: 'M8.3 14.1c-.7 1.3-1.1 2.1-1.1 2.7a1.1 1.1 0 0 0 2.2 0c0-.6-.4-1.4-1.1-2.7zM15.7 14.1c-.7 1.3-1.1 2.1-1.1 2.7a1.1 1.1 0 0 0 2.2 0c0-.6-.4-1.4-1.1-2.7z',
      fill: '#4db5ff'
    }
  ],
  'cat-happy': [...CAT, { d: 'M7.8 12.2a1.4 1.4 0 0 1 2.4 0M13.8 12.2a1.4 1.4 0 0 1 2.4 0', stroke: INK, width: 1.2 }],
  'cat-hurt': [
    ...CAT,
    { d: 'M7.8 10.5l2.4 2.4M10.2 10.5l-2.4 2.4M13.8 10.5l2.4 2.4M16.2 10.5l-2.4 2.4', stroke: INK, width: 1.1 }
  ],
  mouse: [
    { d: circle(5.5, 7.5, 4.2) + circle(18.5, 7.5, 4.2), fill: '#aeb0c2' },
    { d: circle(5.5, 7.5, 2.5) + circle(18.5, 7.5, 2.5), fill: '#ffb3c1' },
    { d: ellipse(12, 14, 7.2, 6.8), fill: '#d3d5e0' },
    { d: circle(9.2, 13, 1.2) + circle(14.8, 13, 1.2), fill: INK },
    { d: circle(12, 16.4, 1.1), fill: '#ff7a8f' },
    { d: 'M2.5 15.5l5 .6M2.8 18.2l4.8-.9M21.5 15.5l-5 .6M21.2 18.2l-4.8-.9', stroke: INK, width: 0.5 }
  ],
  cheese: [
    { d: 'M2.5 12L16 5.5l5.5 6.5z', fill: '#ffe27a', stroke: '#e39a00', width: 1 },
    { d: 'M2.5 12h19v7h-19z', fill: '#ffc233', stroke: '#e39a00', width: 1 },
    { d: circle(7.5, 15.5, 1.4) + circle(14.5, 16, 1.7) + circle(18.8, 14, 0.9), fill: '#e8a41c' }
  ],
  kid: [
    ...KID,
    { d: circle(9, 13, 1.2) + circle(15, 13, 1.2), fill: INK },
    { d: 'M9.5 16.5a3 3 0 0 0 5 0', stroke: INK, width: 1.2 }
  ],
  'kid-happy': [
    ...KID,
    { d: 'M7.8 13.5a1.4 1.4 0 0 1 2.4 0M13.8 13.5a1.4 1.4 0 0 1 2.4 0', stroke: INK, width: 1.2 },
    { d: 'M8.8 15.5h6.4a3.2 3.2 0 0 1-6.4 0z', fill: '#c2542b' }
  ],
  'kid-scared': [
    ...KID,
    { d: circle(9, 12.5, 1.6) + circle(15, 12.5, 1.6), fill: '#fff', stroke: INK, width: 0.8 },
    { d: circle(9, 12.5, 0.7) + circle(15, 12.5, 0.7) + ellipse(12, 17, 1.6, 2), fill: INK }
  ],
  castle: [
    {
      d: 'M3 21V8h3v2h2V8h3v2h2V8h3v2h2V8h3v13h-7.5v-5a1.5 1.5 0 0 0-3 0v5z',
      fill: '#ff4d5e',
      stroke: '#fff',
      width: 1
    },
    { d: 'M12 2v5M12 2l4 1.5L12 5', stroke: '#ffc233', width: 1.2 }
  ],
  house: [
    { d: 'M4.5 11v10h15V11', fill: '#fff4e2', stroke: '#c98b5e', width: 1 },
    { d: 'M2 12L12 3l10 9-1.6 1.7L12 6.2l-8.4 7.5z', fill: '#ff4d5e' },
    { d: 'M10 21v-5h4v5z', fill: '#8a5a3b' }
  ],
  bear: [
    { d: circle(6, 6.5, 3) + circle(18, 6.5, 3), fill: '#8a5a3b' },
    { d: circle(12, 13, 8.5), fill: '#8a5a3b' },
    { d: ellipse(12, 16, 4, 3.2), fill: '#d9b38c' },
    { d: circle(8.8, 11.5, 1.2) + circle(15.2, 11.5, 1.2) + ellipse(12, 14.8, 1.5, 1.1), fill: INK }
  ],
  fire: [
    { d: 'M4 20.5l16-3M4 17.5l16 3', stroke: '#8a5a3b', width: 2.4 },
    {
      d: 'M12 2c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.4 1.2-3.6 2.2-4.8.3 1.5 1 2.4 2 2.8C10 8 10.5 5 12 2z',
      fill: '#ff6a1f'
    },
    {
      d: 'M12 9c.6 2 3 3.1 3 5.8a3 3 0 0 1-6 0c0-1.7 1-2.5 1.6-3.3.3.9.7 1.3 1.2 1.5C11.5 11.8 11.6 10.4 12 9z',
      fill: '#ffc233'
    }
  ],
  pine: [
    { d: 'M11 19h2v4h-2z', fill: '#7a4e2e' },
    { d: 'M12 1l5 7h-2.5l4 6h-2.5l4 6H4l4-6H5.5l4-6H7z', fill: '#2f8f5b' },
    { d: 'M12 1l2.5 3.5h-5zM9.5 8h5l1 1.5h-7zM8 14h8l1 1.5H7z', fill: '#fff' }
  ],
  meat: [
    { d: 'M15.5 8.5l3.5-3.5', stroke: '#fff8ec', width: 2.4 },
    { d: circle(19.5, 3.5, 1.6) + circle(21, 5.2, 1.6), fill: '#fff8ec', stroke: '#d8cbb6', width: 0.5 },
    { d: 'M4.5 13.5a6.5 6.5 0 0 1 10-6l2.5 2.5a6.5 6.5 0 0 1-6 10 6.5 6.5 0 0 1-6.5-6.5z', fill: '#c2542b' },
    { d: 'M7.5 12.5a3.5 3.5 0 0 1 4-3', stroke: '#e98a63', width: 1.3 }
  ],
  brush: [
    { d: 'M3.5 19.5l9.5-9.5 2 2-9.5 9.5a1.4 1.4 0 0 1-2-2z', fill: '#57aef5', stroke: LINE, width: 1.2 },
    { d: 'M12 8.5l4.5-4.5 3.5 3.5-4.5 4.5z', fill: '#fff', stroke: LINE, width: 1.2 },
    { d: 'M16 3.5l1-1M18.5 6l1-1M21 8.5l1-1', stroke: LINE, width: 1.2 }
  ],
  drill: [
    { d: 'M2.5 9.5h12a3 3 0 0 1 0 6h-12z', fill: '#e8edf5', stroke: LINE, width: 1.2 },
    { d: 'M4.5 11h5v3h-5z', fill: '#57aef5' },
    { d: 'M17.5 11l5 1.5-5 1.5z', fill: '#c9d2de', stroke: LINE, width: 1.1 },
    { d: 'M19 9l1-2M19 16l1 2', stroke: '#ffc233', width: 1.3 }
  ],
  tweezers: [
    { d: 'M6 3l6 18M18 3l-6 18', stroke: LINE, width: 3.4 },
    { d: 'M6 3l6 18M18 3l-6 18', stroke: '#c9d2de', width: 1.6 }
  ],
  filling: [
    { d: 'M3 19.5l9-6 1.5 2-9 6a1.2 1.2 0 0 1-1.5-2z', fill: '#ffc233', stroke: LINE, width: 1.2 },
    { d: 'M13 9c3-3 7-2.5 8 .5-1 3.5-5 4-8 2z', fill: '#fffdf6', stroke: LINE, width: 1.2 }
  ],
  pliers: [
    { d: 'M5 21c2-5 4-8 6-10M19 21c-2-5-4-8-6-10', stroke: LINE, width: 3.8 },
    { d: 'M5 21c2-5 4-8 6-10M19 21c-2-5-4-8-6-10', stroke: '#ff4d5e', width: 2 },
    { d: 'M11 11l-1-8M13 11l1-8', stroke: LINE, width: 3.2 },
    { d: 'M11 11l-1-8M13 11l1-8', stroke: '#c9d2de', width: 1.4 },
    { d: circle(12, 11.5, 1.6), fill: '#fff', stroke: LINE, width: 1 }
  ],
  shot: [
    { d: 'M9 3.5h8M13 3.5v3', stroke: LINE, width: 1.4 },
    { d: 'M9.5 6.5h7v10h-7z', fill: '#dff3ff', stroke: LINE, width: 1.2 },
    { d: 'M10.5 10h5v5.5h-5z', fill: '#7fd0ff' },
    { d: 'M13 16.5v5', stroke: LINE, width: 1.2 }
  ],
  pat: [
    {
      d: 'M6 14c-2-4 1-5 2.5-3.5V5.5a1.5 1.5 0 0 1 3 0v-1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v8c0 4.5-3 7-7 7-3.5 0-6-2.5-7.5-8z',
      fill: '#ffd9b8',
      stroke: LINE,
      width: 1.2
    },
    { d: 'M20 3.2c.6-1 2.2-.8 2.2.5 0 1.2-2.2 2.3-2.2 2.3s-2.2-1.1-2.2-2.3c0-1.3 1.6-1.5 2.2-.5z', fill: '#ff7f8f' }
  ],
  germ: [
    { d: circle(12, 12, 7.5), fill: '#82d65a', stroke: LINE, width: 1.3 },
    { d: ellipse(9.3, 11, 2, 2.4) + ellipse(14.7, 11, 2, 2.4), fill: '#fff' },
    { d: circle(9.8, 11.5, 1) + circle(15.2, 11.5, 1), fill: LINE },
    { d: 'M9 15.5q3 2 6 0', stroke: LINE, width: 1.1 }
  ],
  tooth: [
    {
      d: 'M5 5c0-2 3-2.5 7-1 4-1.5 7-1 7 1 0 4-1 6-2 9l-1.5 7c-.4 1.5-2 1.5-2.3 0L12 16l-1.2 5c-.3 1.5-1.9 1.5-2.3 0L7 14c-1-3-2-5-2-9z',
      fill: '#fffdf6',
      stroke: LINE,
      width: 1.2
    }
  ],
  help: [
    { d: 'M8.3 9a3.7 3.7 0 1 1 5.4 3.3c-1.1.6-1.7 1.3-1.7 2.5v.4', stroke: LINE, width: 2.8 },
    { d: circle(12, 19.3, 1.6), fill: LINE }
  ],
  download: [
    { d: 'M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4', stroke: LINE, width: 2.2 },
    { d: 'M12 3.5v11M7.5 10L12 14.5l4.5-4.5', stroke: LINE, width: 2.2 }
  ],
  upload: [
    { d: 'M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4', stroke: LINE, width: 2.2 },
    { d: 'M12 14.5v-11M7.5 8L12 3.5 16.5 8', stroke: LINE, width: 2.2 }
  ],
  share: [
    {
      d: 'M8.5 9.5h-2A1.5 1.5 0 0 0 5 11v8.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-1.5-1.5h-2',
      stroke: LINE,
      width: 2.2
    },
    { d: 'M12 14.5V3M8.5 6.5L12 3l3.5 3.5', stroke: LINE, width: 2.2 }
  ],
  wolf: [
    { d: 'M4.5 10.5L5.5 2.5l6.5 4.5zM19.5 10.5l-1-8-6.5 4.5z', fill: '#8e8a9c', stroke: LINE, width: 1.2 },
    { d: 'M6.4 8.6l.5-3.9 3 2.1zM17.6 8.6l-.5-3.9-3 2.1z', fill: '#ffb3c1' },
    { d: circle(12, 13, 8), fill: '#b3aec2', stroke: LINE, width: 1.2 },
    { d: ellipse(12, 16.8, 4.3, 3.3), fill: '#f1eef6' },
    { d: circle(9, 11.8, 1.2) + circle(15, 11.8, 1.2) + ellipse(12, 15.2, 1.8, 1.2), fill: INK },
    { d: 'M7.2 9.6l2.9 1M16.8 9.6l-2.9 1', stroke: INK, width: 1 },
    { d: 'M10.4 17.6a1.6 1.6 0 0 0 1.6-.9 1.6 1.6 0 0 0 1.6.9', stroke: INK, width: 0.8 }
  ],
  sheep: [
    { d: ellipse(4.6, 12.5, 3, 1.7) + ellipse(19.4, 12.5, 3, 1.7), fill: '#f2c9b0', stroke: LINE, width: 1 },
    // ふちを描いてから同じ形を塗って、重なった丸の内側の線を消す（もこもこの外周だけ残す）
    { d: WOOL, stroke: LINE, width: 2.4 },
    { d: WOOL, fill: '#fff' },
    { d: ellipse(12, 14.8, 4.8, 5.6), fill: '#f7dcc8', stroke: LINE, width: 1.2 },
    { d: circle(10, 9.8, 2.3) + circle(14, 9.8, 2.3) + circle(12, 9, 2.3), fill: '#fff' },
    { d: circle(10, 14.2, 1) + circle(14, 14.2, 1), fill: INK },
    { d: circle(8.8, 16.6, 1) + circle(15.2, 16.6, 1), fill: '#ff9aa8' },
    { d: 'M11 17.4q1 .9 2 0', stroke: INK, width: 0.9 }
  ],
  cabbage: [
    { d: circle(12, 12.5, 9.5), fill: '#8fd47a', stroke: LINE, width: 1.2 },
    { d: ellipse(12, 12.5, 5.5, 7), fill: '#c6efb0', stroke: '#5fae4f', width: 1 },
    {
      d: 'M4.5 8.5c3 2 4 7.5 3 12.5M19.5 8.5c-3 2-4 7.5-3 12.5M12 7v11M12 11l-2.5-2M12 14l2.5-2',
      stroke: '#5fae4f',
      width: 1.1
    }
  ],
  adult: [
    { d: 'M3.5 23a8.5 7.5 0 0 1 17 0z', fill: '#8ec9ff', stroke: LINE, width: 1.2 },
    { d: 'M10 15.5l2 2.5 2-2.5z', fill: '#fff' },
    { d: circle(12, 9, 6), fill: SKIN, stroke: LINE, width: 1.2 },
    { d: 'M6 9c-.5-4 2.2-6.5 6-6.5s6.5 2.5 6 6.5c-1-2-3-3-6-3.2-2 1.2-4 2-6 3.2z', fill: '#6b4a35' },
    { d: circle(9.8, 10, 0.9) + circle(14.2, 10, 0.9), fill: INK },
    { d: 'M10.2 12.4a2.4 2.4 0 0 0 3.6 0', stroke: INK, width: 1 }
  ],
  detective: [
    ...DETECTIVE,
    { d: circle(9.8, 14, 0.9) + circle(14.2, 14, 0.9), fill: INK },
    { d: 'M10.8 16.6q1.2.8 2.4 0', stroke: INK, width: 0.9 }
  ],
  'detective-happy': [
    ...DETECTIVE,
    { d: 'M8.8 14.3a1.1 1.1 0 0 1 2 0M13.2 14.3a1.1 1.1 0 0 1 2 0', stroke: INK, width: 1.1 },
    { d: 'M10.2 15.9h3.6a1.8 1.8 0 0 1-3.6 0z', fill: '#c2542b' }
  ],
  'detective-sad': [
    ...DETECTIVE,
    { d: circle(9.8, 14.2, 0.8) + circle(14.2, 14.2, 0.8), fill: INK },
    { d: 'M8.6 12.9l1.9-.5M15.4 12.9l-1.9-.5M10.8 17.3q1.2-.8 2.4 0', stroke: INK, width: 0.9 },
    { d: 'M18.8 9.2c-.6 1.1-.9 1.8-.9 2.3a.9.9 0 0 0 1.8 0c0-.5-.3-1.2-.9-2.3z', fill: '#4db5ff' }
  ],
  magnifier: [
    { d: 'M14 14l6.5 6.5', stroke: LINE, width: 3.6 },
    { d: 'M14.4 14.4l5.8 5.8', stroke: '#8a5a3b', width: 2 },
    { d: circle(9.5, 9.5, 6), fill: '#dff3ff', stroke: LINE, width: 1.6 },
    { d: 'M6.3 8.2a3.6 3.6 0 0 1 2.6-2.6', stroke: '#fff', width: 1.3 }
  ],
  check: [
    { d: circle(12, 12, 10), fill: '#9be0a6', stroke: LINE, width: 1.6 },
    { d: 'M7.5 12.5l3 3 6-6.5', stroke: LINE, width: 2.2 }
  ],
  cross: [
    { d: circle(12, 12, 10), fill: '#ff9fb3', stroke: LINE, width: 1.6 },
    { d: 'M8.5 8.5l7 7M15.5 8.5l-7 7', stroke: LINE, width: 2.2 }
  ],
  frisbee: [
    { d: ellipse(12, 13, 10, 5.5), fill: '#ff8fa6', stroke: LINE, width: 1.4 },
    { d: ellipse(12, 12, 5.5, 2.6), fill: '#ffb3c3', stroke: LINE, width: 1 }
  ],
  wand: [
    { d: 'M4 21L15.5 8.5', stroke: '#c97b4a', width: 1.8 },
    {
      d: 'M15 9c-1-4 1.5-6.5 4.5-6.5.8 3-1 6.5-4.5 6.5zM15 9c2-2 4.5-2 6.5-.5-1.5 2.5-4.5 2.5-6.5.5z',
      fill: '#ffd966',
      stroke: LINE,
      width: 1.2
    }
  ],
  heart: [
    {
      d: 'M12 20.5C6 16.3 2.5 12.8 2.5 8.8A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 9.5 2.2c0 4-3.5 7.5-9.5 11.7z',
      fill: '#ff6b8a',
      stroke: LINE,
      width: 1.4
    },
    { d: 'M6 8.5a2.4 2.4 0 0 1 2-2', stroke: '#fff', width: 1.4 }
  ],
  drop: [
    {
      d: 'M12 2.5c3.5 5 6.5 8.5 6.5 12a6.5 6.5 0 0 1-13 0c0-3.5 3-7 6.5-12z',
      fill: '#7cc8ff',
      stroke: LINE,
      width: 1.4
    },
    { d: 'M9 14.5a3 3 0 0 0 2 3', stroke: '#fff', width: 1.4 }
  ],
  ball: [
    { d: circle(12, 12, 9), fill: '#c8f05a', stroke: LINE, width: 1.4 },
    { d: 'M4.5 7.5c4 1.5 4 7.5 0 9M19.5 7.5c-4 1.5-4 7.5 0 9', stroke: '#fff', width: 1.4 }
  ],
  bowl: [
    { d: ellipse(12, 11, 7.5, 2.5), fill: '#c97b4a' },
    { d: circle(8.5, 9.8, 1.6) + circle(12, 9.2, 1.7) + circle(15.5, 9.8, 1.6), fill: '#a8603a' },
    { d: 'M2.5 12h19a9.5 7.5 0 0 1-19 0z', fill: '#57aef5', stroke: LINE, width: 1.4 }
  ],
  camera: [
    {
      d: 'M3 8.5a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      fill: '#b9c2d6',
      stroke: LINE,
      width: 1.4
    },
    { d: circle(12, 13, 4.2), fill: '#3a4a6b', stroke: LINE, width: 1.2 },
    { d: 'M10.3 11.6a2 2 0 0 1 1.6-1', stroke: '#fff', width: 1.2 }
  ],
  bag: [
    { d: 'M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8', stroke: LINE, width: 1.6 },
    { d: 'M4.5 8h15l-1 12.5h-13z', fill: '#ffc233', stroke: LINE, width: 1.4 },
    { d: circle(12, 14, 1.8), fill: '#ff6b8a' }
  ],
  paw: [
    { d: ellipse(12, 16, 5, 4.2), fill: '#c97b4a', stroke: LINE, width: 1.2 },
    {
      d: circle(5.5, 10.5, 2) + circle(9.3, 6.8, 2.1) + circle(14.7, 6.8, 2.1) + circle(18.5, 10.5, 2),
      fill: '#c97b4a'
    }
  ],
  gift: [
    { d: 'M4 10h16v10.5H4z', fill: '#ff6b8a', stroke: LINE, width: 1.4 },
    { d: 'M3 7h18v3.5H3z', fill: '#ff8fa6', stroke: LINE, width: 1.4 },
    { d: 'M10.5 7h3v13.5h-3z', fill: '#ffc233' },
    { d: 'M12 7C9 2.5 5.5 4.5 8 7M12 7c3-4.5 6.5-2.5 4 0', stroke: LINE, width: 1.4 }
  ],
  'collar-red': [
    ...collar('#e8414f'),
    { d: circle(12, 18.3, 3.3), fill: '#ffc233', stroke: LINE, width: 1.2 },
    { d: 'M8.9 17.6h6.2M12 19.6v2', stroke: LINE, width: 1 },
    { d: 'M10.6 16.6a1.6 1.6 0 0 1 1.2-.8', stroke: '#fff', width: 0.9 }
  ],
  'collar-blue': [...collar('#3b82e0'), { d: BONE, stroke: LINE, width: 2.4 }, { d: BONE, fill: '#ffc233' }],
  ribbon: [
    {
      d: 'M11 12.5l-4.2 8.3 2.4-.5 1.1 2.1 2.7-9zM13 12.5l4.2 8.3-2.4-.5-1.1 2.1-2.7-9z',
      fill: '#ff5fa2',
      stroke: LINE,
      width: 1.2
    },
    {
      d: 'M12 11C9 6.5 2.5 5 2.5 9.8v2.4c0 4.8 6.5 3.3 9.5-1.2zM12 11c3-4.5 9.5-6 9.5-1.2v2.4c0 4.8-6.5 3.3-9.5-1.2z',
      fill: '#ff85be',
      stroke: LINE,
      width: 1.4
    },
    { d: 'M5 8.6c1.2-.9 2.8-.6 4 .4', stroke: '#fff', width: 1 },
    { d: ellipse(12, 11.2, 2.3, 2.7), fill: '#e8468c', stroke: LINE, width: 1.2 }
  ],
  bandana: [
    // 結んだ端を右上に出して、布を首に巻いた形に見せる（ただの三角だとピザに見える）
    {
      d: 'M17.5 5.5c1.5-2.5 3.5-3 5-2.5-.5 1.8-2 3-4 3.2M18 7c1.8 0 3.4.8 4 2.3-1.8.6-3.4 0-4.3-1.3',
      fill: '#e2404f',
      stroke: LINE,
      width: 1.2
    },
    { d: 'M2.5 7.5h17c-1.6 4.8-4.4 9.6-8.5 14-4.1-4.4-6.9-9.2-8.5-14z', fill: '#e2404f', stroke: LINE, width: 1.4 },
    {
      d:
        circle(7.5, 10.5, 1.2) +
        circle(14.5, 10.5, 1.2) +
        circle(11, 15, 1.2) +
        circle(11, 10.2, 0.7) +
        circle(9.2, 13, 0.6) +
        circle(12.8, 13, 0.6),
      fill: '#fff6ea'
    },
    { d: 'M3 4.5h15a1.8 1.8 0 0 1 0 3.6H3a1.8 1.8 0 0 1 0-3.6z', fill: '#ff6b78', stroke: LINE, width: 1.4 },
    { d: circle(18.3, 6.3, 1.5), fill: '#e2404f', stroke: LINE, width: 1.2 }
  ],
  hat: [
    { d: 'M4.5 17a7.5 9.5 0 0 1 15 0z', fill: '#f5b731', stroke: LINE, width: 1.4 },
    { d: 'M6.2 12.2h11.6', stroke: '#fff3dc', width: 1.8 },
    { d: circle(12, 5, 2.5), fill: '#fff3e0', stroke: LINE, width: 1.2 },
    {
      d: 'M4.5 16h15a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-2A1.5 1.5 0 0 1 4.5 16z',
      fill: '#e8a21a',
      stroke: LINE,
      width: 1.4
    },
    { d: 'M6.5 17v3M9.5 17v3M12.5 17v3M15.5 17v3M18 17v3', stroke: '#c98710', width: 0.9 }
  ],
  sun: [
    {
      d: 'M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1',
      stroke: '#f0a020',
      width: 1.8
    },
    { d: circle(12, 12, 5), fill: '#ffc233', stroke: LINE, width: 1.4 }
  ],
  sunset: [
    { d: 'M12 3.5V6M5.2 7.2l1.7 1.7M18.8 7.2l-1.7 1.7', stroke: '#ff8a3c', width: 1.8 },
    { d: 'M5 16.5a7 7 0 0 1 14 0z', fill: '#ffa45a', stroke: LINE, width: 1.4 },
    { d: 'M2.5 16.5h19M6 20h12', stroke: LINE, width: 1.4 }
  ],
  cloud: [
    {
      d: 'M7 18.5h10.5a4 4 0 0 0 .6-8a5.6 5.6 0 0 0-10.8-1.2A4.3 4.3 0 0 0 7 18.5z',
      fill: '#eef2f7',
      stroke: LINE,
      width: 1.4
    }
  ],
  rain: [
    { d: 'M8.5 17.5l-1.2 3M12.5 17.5l-1.2 3M16.5 17.5l-1.2 3', stroke: '#3d9be9', width: 1.9 },
    {
      d: 'M7 14.5h10.5a4 4 0 0 0 .6-8a5.6 5.6 0 0 0-10.8-1.2A4.3 4.3 0 0 0 7 14.5z',
      fill: '#dfe6ee',
      stroke: LINE,
      width: 1.4
    }
  ],
  snow: [
    { d: 'M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6', stroke: '#5aa9f0', width: 1.9 },
    { d: 'M9.8 3.8L12 6l2.2-2.2M9.8 20.2L12 18l2.2 2.2', stroke: '#5aa9f0', width: 1.4 },
    { d: circle(12, 12, 2.4), fill: '#ffffff', stroke: '#5aa9f0', width: 1.2 }
  ],
  moon: [
    { d: 'M15.5 3a8.5 8.5 0 1 0 5.5 13.5A7 7 0 0 1 15.5 3z', fill: '#ffd966', stroke: LINE, width: 1.4 },
    { d: 'M17 5.5h3l-3 3.5h3', stroke: LINE, width: 1.2 }
  ],
  plus: [
    { d: circle(12, 12, 10), fill: '#9be0a6', stroke: LINE, width: 1.6 },
    { d: 'M12 7v10M7 12h10', stroke: LINE, width: 2.2 }
  ],
  trophy: [
    { d: 'M7 5H3.5v2.5A4 4 0 0 0 7.5 11.5M17 5h3.5v2.5a4 4 0 0 1-4 4', stroke: LINE, width: 1.5 },
    { d: 'M6.5 3h11v5a5.5 5.5 0 0 1-11 0z', fill: '#ffc233', stroke: LINE, width: 1.4 },
    { d: 'M10.5 13.3h3v3.7h-3z', fill: '#e39a00', stroke: LINE, width: 1.2 },
    { d: 'M7.5 17h9v4h-9z', fill: '#a8683f', stroke: LINE, width: 1.4 },
    { d: 'M9 5v3.5', stroke: '#fff3a0', width: 1.4 }
  ]
} satisfies Record<string, Layer[]>;

export type IconName = keyof typeof ICONS;
