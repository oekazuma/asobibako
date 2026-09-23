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
const palm = 'M6.5 12.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z';

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
  ]
} satisfies Record<string, Layer[]>;

export type IconName = keyof typeof ICONS;
