import { LINE, circle, ellipse, g, line, path, poly, rect, text } from '../fig';
import type { Puzzle, Shape } from '../types';

const dashed = { 'stroke-dasharray': '4 3' };

// ---- 積み木の三面図 ----

/** 左下 (x, y) から、列ごとの高さ heights の積み木を横から見た形 */
const view = (x: number, y: number, heights: number[], fill: string, u = 20) =>
  heights.flatMap((h, i) => Array.from({ length: h }, (_, k) => rect(x + i * u, y - (k + 1) * u, u, u, fill)));

// ---- 折り紙 ----

const FOLD = 11;
const PAPER = FOLD * 6;

/** 6×6 の方眼のうち、pick(i, j) が真のますだけを描く（斜めに切れたますは三角形で描く） */
const paper = (ox: number, oy: number, part: (x: number, y: number) => boolean): Shape[] => {
  const out: Shape[] = [];
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6; i++) {
      const c: [number, number][] = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1]
      ];
      const inside = c.filter(([x, y]) => part(x, y));
      if (inside.length < 3) continue;
      out.push(
        poly(
          inside.map(([x, y]) => [ox + x * FOLD, oy + y * FOLD]),
          '#ffe3ec',
          { 'stroke-width': 0.8, stroke: '#d9a7b5' }
        )
      );
    }
  return out;
};

const outline = (ox: number, oy: number) =>
  rect(ox, oy, PAPER, PAPER, 'none', { ...dashed, stroke: '#c9bdb6', 'stroke-width': 1 });

/** (x1, y1) から (x2, y2) へ、制御点 (qx, qy) で曲がる矢印。先は (qx, qy) からの向き */
const curved = (x1: number, y1: number, qx: number, qy: number, x2: number, y2: number) => {
  const len = Math.hypot(x2 - qx, y2 - qy);
  const [dx, dy] = [(x2 - qx) / len, (y2 - qy) / len];
  return g(
    '',
    path(`M${x1} ${y1}Q${qx} ${qy} ${x2 - dx * 4} ${y2 - dy * 4}`, 'none', { stroke: '#e0708a', 'stroke-width': 2 }),
    poly(
      [
        [x2 + dx * 3, y2 + dy * 3],
        [x2 - dx * 6 - dy * 5, y2 - dy * 6 + dx * 5],
        [x2 - dx * 6 + dy * 5, y2 - dy * 6 - dx * 5]
      ],
      '#e0708a',
      { stroke: 'none' }
    )
  );
};

const hole = (ox: number, oy: number, i: number, j: number) =>
  circle(ox + (i + 0.5) * FOLD, oy + (j + 0.5) * FOLD, 3.5, LINE, { stroke: 'none' });

// ---- さいころ ----

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73]
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75]
  ]
};

/** 単位正方形を matrix で面に写し、目を置く */
const face = (m: string, n: number) =>
  g(
    `matrix(${m})`,
    path('M0 0H1V1H0Z', '#fff', { 'stroke-width': 0.04 }),
    ...PIPS[n].map(([u, v]) => circle(u, v, n === 1 ? 0.14 : 0.1, n === 1 ? '#e0506a' : LINE, { stroke: 'none' }))
  );

/** 正面の左上が (x, y)、1 辺 s の立方体を、上・手前・右の 3 面が見えるように描く */
const die = (x: number, y: number, s: number, top: number, front: number, right: number) => {
  const d = s * 0.45;
  return [
    face(`${s} 0 ${-d} ${d} ${x + d} ${y - d}`, top),
    face(`${d} ${-d} 0 ${s} ${x + s} ${y}`, right),
    face(`${s} 0 0 ${s} ${x} ${y}`, front)
  ];
};

const CELL = 26;
const BOARD = { x: 33, y: 86 };
/** 道のますを順に並べたもの */
const ROUTE: [number, number][] = [
  ...Array.from({ length: 9 }, (_, i): [number, number] => [i, 0]),
  [8, 1],
  [8, 2],
  ...Array.from({ length: 7 }, (_, i): [number, number] => [7 - i, 2]),
  [1, 3],
  [1, 4],
  [1, 5],
  ...Array.from({ length: 7 }, (_, i): [number, number] => [2 + i, 5])
];
const cellMid = ([i, j]: [number, number]): [number, number] => [
  BOARD.x + (i + 0.5) * CELL,
  BOARD.y + (j + 0.5) * CELL
];

// ---- ピンボード ----

const PINS = Array.from({ length: 25 }, (_, k): [number, number] => [k % 5, Math.floor(k / 5)]).filter(
  ([i, j]) => !((i === 0 || i === 4) && (j === 0 || j === 4))
);
const pinAt = (i: number, j: number): [number, number] => [62 + i * 44, 22 + j * 44];

// ---- てんびん ----

type Fruit = 'melon' | 'apple' | 'orange';
const SIZE: Record<Fruit, number> = { melon: 13, apple: 9, orange: 7 };

const fruit = (kind: Fruit, x: number, y: number): Shape[] => {
  if (kind === 'melon')
    return [
      circle(x, y, 13, '#bfe3a0'),
      path(`M${x - 9} ${y - 5}q9 5 18 0M${x - 11} ${y + 3}q11 5 22 0M${x} ${y - 13}v26`, 'none', {
        'stroke-width': 1,
        stroke: '#6e9a52'
      })
    ];
  if (kind === 'apple') return [circle(x, y, 9, '#f58a8a'), line(x, y - 9, x + 2, y - 13, { 'stroke-width': 1.5 })];
  return [circle(x, y, 7, '#ffb85c'), circle(x, y - 6, 1.5, '#7cb35a', { stroke: 'none' })];
};

/** 皿の上 (x, y) に果物を並べる。皿の幅からあふれたら上の段へ */
const pile = (x: number, y: number, items: Fruit[]): Shape[] => {
  const out: Shape[] = [];
  let rest = [...items];
  let base = y;
  while (rest.length) {
    let n = 1;
    while (n < rest.length && rest.slice(0, n + 1).reduce((w, k) => w + SIZE[k] * 2 + 1, 0) <= 62) n++;
    const now = rest.slice(0, n);
    rest = rest.slice(n);
    const r = Math.max(...now.map((k) => SIZE[k]));
    const widths = now.map((k) => SIZE[k] * 2 + 1);
    let cx = x - widths.reduce((a, b) => a + b, 0) / 2;
    now.forEach((k, i) => {
      out.push(...fruit(k, cx + widths[i] / 2, base - SIZE[k]));
      cx += widths[i];
    });
    base -= r * 2 - 2;
  }
  return out;
};

/** 支点が (cx, y) のてんびん。tilt は左の皿の下がる量 */
const balance = (cx: number, y: number, left: Fruit[], right: Fruit[] | string, tilt = 0): Shape[] => {
  const arm = 44;
  const pan = (x: number, top: number, items: Fruit[] | string) => [
    line(x, top, x - 26, top + 44, { 'stroke-width': 1 }),
    line(x, top, x + 26, top + 44, { 'stroke-width': 1 }),
    ...(typeof items === 'string' ? [text(x, top + 32, items, 20)] : pile(x, top + 44, items)),
    path(`M${x - 30} ${top + 44}h60q-4 9 -30 9t-30 -9z`, '#f7ecd9')
  ];
  return [
    poly(
      [
        [cx, y],
        [cx - 16, y + 62],
        [cx + 16, y + 62]
      ],
      '#d7c4ad'
    ),
    line(cx - arm, y + tilt, cx + arm, y - tilt, { 'stroke-width': 4 }),
    circle(cx, y, 3.5, LINE),
    ...pan(cx - arm, y + tilt, left),
    ...pan(cx + arm, y - tilt, right)
  ];
};

// ---- 影 ----

/** 1 辺 48 の枠の中の影。u は左 0 右 1、v は下 0 上 1 */
const SHADOWS: ((cx: number, cy: number) => Shape)[] = (() => {
  const S = 48;
  const fill = '#9d918b';
  const none = { stroke: 'none' };
  const at = (cx: number, cy: number, pts: [number, number][]) =>
    poly(
      pts.map(([u, v]) => [cx - S / 2 + u * S, cy + S / 2 - v * S]),
      fill,
      none
    );
  return [
    (cx, cy) => rect(cx - S / 2, cy, S, S / 2, fill, none),
    (cx, cy) => circle(cx, cy, S / 2, fill, none),
    (cx, cy) =>
      at(cx, cy, [
        [0, 0],
        [1, 0],
        [0, 1]
      ]),
    (cx, cy) =>
      at(cx, cy, [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5]
      ]),
    (cx, cy) => circle(cx, cy, S / 4, fill, none),
    (cx, cy) =>
      at(cx, cy, [
        [0, 1],
        [1, 1],
        [0.5, 0]
      ]),
    (cx, cy) =>
      at(cx, cy, [
        [0, 0],
        [1, 0],
        [1, 1 / 3],
        [1 / 3, 1 / 3],
        [1 / 3, 1],
        [0, 1]
      ]),
    (cx, cy) => rect(cx - S / 2, cy - S / 2, S, S, fill, none),
    (cx, cy) =>
      at(cx, cy, [
        [0, 0],
        [1, 0],
        [0.5, 1]
      ]),
    (cx, cy) => path(`M${cx - S / 2} ${cy + S / 2}a${S / 2} ${S / 2} 0 0 1 ${S} 0z`, fill, none),
    (cx, cy) => rect(cx - S / 4, cy - S / 2, S / 2, S, fill, none),
    (cx, cy) => ellipse(cx, cy, S / 2, S / 4, fill, none)
  ];
})();
const shadowX = (k: number) => 54 + (k % 4) * 64;
const shadowY = (k: number) => 118 + Math.floor(k / 4) * 64;

export default [
  {
    kind: 'number',
    title: '積み木の三面図',
    text: '同じ大きさの立方体の積み木を、3×3のます目の上に積んだ。正面・右・真上から見ると、図のように見える。積み木は床から積み上げ、宙に浮かせたものはない。積み木は少なくとも何個あるだろうか？',
    fig: {
      w: 300,
      h: 150,
      s: [
        text(46, 16, '正面から', 12),
        text(146, 16, '右から', 12),
        text(246, 16, '真上から', 12),
        line(8, 126, 88, 126, { 'stroke-width': 3 }),
        ...view(16, 126, [3, 4, 3], '#ffd8a8'),
        line(108, 126, 188, 126, { 'stroke-width': 3 }),
        ...view(116, 126, [4, 3, 1], '#cfe8ff'),
        text(126, 140, '手前', 11),
        text(166, 140, '奥', 11),
        ...[0, 1, 2].flatMap((j) => view(216, 66 + (j + 1) * 20, [1, 1, 1], '#d8f0c8')),
        text(246, 140, '手前', 11),
        text(246, 56, '奥', 11)
      ]
    },
    answer: 16,
    unit: '個',
    hints: [
      '見えない場所には、積み木がなくてもかまわない。どの図にも、その列でいちばん高いところしか映らない。',
      '正面から見た列と右から見た列は、真上から見ると交わる。その交わるますに柱を立てれば、2つの図を一度に満たせる。',
      '4段の柱は1本で足りる。3段は正面の左右の列と、右から見た真ん中の列に要るが、1本で2つを兼ねられる。'
    ],
    why: '真上の図から、9ますすべてに少なくとも1個ずつ要る。高い柱は、正面の列と右から見た列が交わるますに立てれば兼用できる。4段は1本、3段は正面の左の列と右から見た真ん中の列を1本で兼ね、正面の右の列にもう1本。9＋3＋2＋2＝16個。'
  },
  {
    kind: 'tap',
    title: '穴あき折り紙',
    text: '6×6ますの方眼紙を、図の①②のように斜めに2回折り、③の2か所に穴をあけた。紙を元どおりに広げたとき、穴があいているますをすべて選んでほしい。',
    fig: {
      w: 356,
      h: 272,
      s: [
        text(47, 10, '① 折る', 12),
        ...paper(14, 18, () => true),
        line(14, 18, 14 + PAPER, 18 + PAPER, { ...dashed, 'stroke-width': 1.5 }),
        curved(30, 68, 32, 36, 60, 36),
        text(47, 100, '② 折る', 12),
        outline(14, 108),
        ...paper(14, 108, (x, y) => x >= y),
        line(14 + PAPER, 108, 14 + PAPER / 2, 108 + PAPER / 2, { ...dashed, 'stroke-width': 1.5 }),
        curved(36, 118, 58, 124, 64, 146),
        text(47, 190, '③ 穴をあける', 12),
        outline(14, 198),
        ...paper(14, 198, (x, y) => x >= y && x + y >= 6),
        hole(14, 198, 4, 3),
        hole(14, 198, 5, 1),
        text(224, 10, '広げた紙', 12),
        ...Array.from({ length: 36 }, (_, k) =>
          rect(104 + (k % 6) * 40, 24 + Math.floor(k / 6) * 40, 40, 40, '#ffe3ec')
        )
      ]
    },
    spots: Array.from({ length: 36 }, (_, k) => ({ x: 124 + (k % 6) * 40, y: 44 + Math.floor(k / 6) * 40, r: 18 })),
    answer: [4, 8, 11, 13, 22, 24, 27, 31],
    hints: [
      '広げるときは、折ったのと逆の順に、折り目を鏡にして穴が映っていく。',
      '折り目はどちらも斜め。縦や横の真ん中で折ったときとは、穴の行き先が違う。',
      '穴は全部で8つ。②の折り目で映すと4つ、さらに①の対角線で映すと8つになる。'
    ],
    why: '③の2つの穴を、まず②の折り目（右上の角から中心へ）で鏡に映すと4つ。次に①の対角線（左上から右下）で映すと8つになる。広げた紙の穴は、どちらの対角線で折り返してもぴったり重なる並びになる。'
  },
  {
    kind: 'number',
    title: 'さいころの旅',
    text: 'さいころを、Sのますから道にそって1ますずつ転がし、Gまで運ぶ。Sでは上が1、手前（図の下側）が2、右が3を向いている。向かい合う面の目を足すと7だ。Gで上を向く目を十の位、手前を向く目を一の位とした2桁の数を答えてほしい。',
    fig: {
      w: 300,
      h: 270,
      s: [
        ...die(60, 30, 36, 1, 2, 3),
        text(190, 46, 'Sでの向き', 13),
        rect(BOARD.x - 6, BOARD.y - 6, CELL * 9 + 12, CELL * 6 + 12, '#e4f3dc', { rx: 8 }),
        ...ROUTE.map(([i, j]) =>
          rect(BOARD.x + i * CELL, BOARD.y + j * CELL, CELL, CELL, '#fff4d6', { 'stroke-width': 1 })
        ),
        path(`M${ROUTE.map(cellMid).join('L')}`, 'none', { stroke: '#e0a060', 'stroke-width': 1.5, ...dashed }),
        text(...cellMid(ROUTE[0]), 'S', 14),
        text(...cellMid(ROUTE.at(-1)!), 'G', 14),
        text(150, 258, '▼ 手前', 12)
      ]
    },
    answer: 63,
    unit: '',
    hints: [
      '1ますずつ追ってもよいが、同じ向きに4回転がすと、さいころは元の向きに戻る。',
      '8回は0回と同じ。7回は3回と同じで、それは逆向きに1回転がすのと同じだ。',
      '道は「下2・右1・上1・左1」に縮まる。下へ2回転がすと、上と下、手前と奥が入れかわる。'
    ],
    why: '同じ向きに4回転がすと元に戻るので、右8は0回、左7は右1回、下3は上1回、右7は左1回と同じ。道は「下2・右1・上1・左1」に縮まる。上と手前は、下2で6と5、右1で4と5、上1で5と3、左1で6と3。答えは63。'
  },
  {
    kind: 'number',
    title: '角のないピンボード',
    text: '板に21本のピンが、図のように並んでいる（四隅の4本はない）。輪ゴムを4本のピンにかけて、正方形を作りたい。大きさや位置の違う正方形は、全部で何通り作れるだろうか？',
    fig: {
      w: 300,
      h: 220,
      s: [
        rect(36, 0, 228, 220, '#f1d9b5', { rx: 18 }),
        path(
          `M${pinAt(1, 1).join(' ')}L${pinAt(2, 1).join(' ')}L${pinAt(2, 2).join(' ')}L${pinAt(1, 2).join(' ')}Z`,
          'none',
          {
            stroke: '#ef7fa0',
            'stroke-width': 3
          }
        ),
        ...PINS.map(([i, j]) => circle(...pinAt(i, j), 5, '#8a7a72')),
        text(pinAt(1, 1)[0] + 22, pinAt(1, 1)[1] + 22, '例', 12)
      ]
    },
    answer: 37,
    unit: '通り',
    hints: [
      '正方形は、板の縁と平行なものだけとは限らない。',
      '輪ゴムは斜めにかけてもよい。横に1、縦に2ずれたピンへ辺を張る、傾いた正方形もある。',
      '縁と平行な正方形は17通り。傾いた正方形は四隅のピンを使わないので、1つも減らない。'
    ],
    why: '縁と平行な正方形は、1辺1が12、2が5、3と4は四隅にかかって0で、17通り。傾いた正方形は、辺が横1縦1のものが9、横1縦2と横2縦1が4ずつ、横1縦3と横3縦1が1ずつ、横2縦2が1で20通り。合わせて37通り。'
  },
  {
    kind: 'number',
    title: '果物のてんびん',
    text: 'メロン・りんご・みかんを、図の①②のようにてんびんにのせると、どちらも釣り合った。同じ果物はどれも同じ重さだ。③の右の皿にみかんを何個のせれば、てんびんは釣り合うだろうか？',
    fig: {
      w: 300,
      h: 200,
      s: [
        text(14, 14, '①', 14),
        ...balance(74, 20, ['melon', 'apple'], Array<Fruit>(7).fill('orange')),
        text(160, 14, '②', 14),
        ...balance(226, 20, ['melon'], ['apple', 'apple', 'orange']),
        text(64, 128, '③', 14),
        ...balance(150, 128, ['melon', 'melon', 'apple'], '?', 10)
      ]
    },
    answer: 12,
    unit: '個',
    hints: [
      'てんびんの片側を、それと釣り合うものに置きかえても、釣り合いは変わらない。',
      '①のメロンを、②でメロンと釣り合っているものに置きかえてみよう。',
      '置きかえると、りんご3個とみかん1個が、みかん7個と釣り合う。りんご1個はみかん何個ぶんだろう。'
    ],
    why: '①のメロンを、②でメロンと釣り合う「りんご2個とみかん1個」に置きかえると、りんご3個とみかん1個がみかん7個と釣り合う。りんご1個はみかん2個ぶん、メロンは2＋2＋1＝5個ぶん。③の左は5＋5＋2で、みかん12個ぶん。'
  },
  {
    kind: 'tap',
    title: '円と正方形の影',
    text: '中身の詰まった立体に、真上からまっすぐ光を当てると影は円に、正面から当てると正方形になった。円の直径と正方形の1辺は同じ長さだ。立体を動かさずに真横から光を当てたとき、影の形としてありえるものをすべて選んでほしい。点線の枠は正方形と同じ大きさだ。',
    fig: {
      w: 300,
      h: 276,
      s: [
        text(96, 14, '真上から', 12),
        circle(96, 50, 24, '#9d918b', { stroke: 'none' }),
        text(204, 14, '正面から', 12),
        rect(180, 26, 48, 48, '#9d918b', { stroke: 'none' }),
        line(20, 88, 280, 88, { 'stroke-width': 1, stroke: '#c9bdb6' }),
        ...SHADOWS.flatMap((draw, k) => [
          rect(shadowX(k) - 24, shadowY(k) - 24, 48, 48, '#fff', { ...dashed, stroke: '#b3a69f', 'stroke-width': 1 }),
          draw(shadowX(k), shadowY(k))
        ])
      ]
    },
    spots: SHADOWS.map((_, k) => ({ x: shadowX(k), y: shadowY(k), r: 30 })),
    answer: [1, 3, 5, 7, 8],
    hints: [
      '答えは正方形だけではない。円柱のほかにも、真上から円・正面から正方形に見える立体はある。',
      '横から見た影は、枠の左右いっぱいに広がっている（真上の円の幅がそうだから）。条件はもう1つある。',
      '正方形の影の左右の縁を作れるのは、円の左右の端の上下の部分だけ。横から見ると、そこは枠の真ん中の縦線になる。'
    ],
    why: '横の影は、左右が枠いっぱいで、枠の真ん中の縦線を上から下まで含んでいれば作れる。三角形なら、底が円で、てっぺんが1本の稜線になるくさび形。1つの栓で円・正方形・三角形の穴をふさげる、あの形だ。直角三角形や半円は真ん中の線が途中で切れ、縦長の長方形は幅が足りない。'
  }
] satisfies Puzzle[];
