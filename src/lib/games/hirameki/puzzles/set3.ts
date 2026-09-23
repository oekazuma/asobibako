import { circle, g, line, LINE, path, poly, rect, text } from '../fig';
import type { Puzzle, Shape } from '../types';

function pips(n: number, size: number): [number, number][] {
  const [a, m, b] = [size * 0.25, size * 0.5, size * 0.75];
  const at: Record<number, [number, number][]> = {
    1: [[m, m]],
    2: [
      [a, a],
      [b, b]
    ],
    3: [
      [a, a],
      [m, m],
      [b, b]
    ],
    4: [
      [a, a],
      [b, a],
      [a, b],
      [b, b]
    ],
    5: [
      [a, a],
      [b, a],
      [m, m],
      [a, b],
      [b, b]
    ],
    6: [
      [a, a],
      [b, a],
      [a, m],
      [b, m],
      [a, b],
      [b, b]
    ]
  };
  return at[n];
}

const pipDots = (n: number, size: number) =>
  pips(n, size).map(([x, y]) =>
    circle(x, y, size * (n === 1 ? 0.17 : 0.09), n === 1 ? '#ff6b6b' : LINE, { stroke: 'none' })
  );

/** さいころ 1 こ。前の面の左上が (x, y)、奥行きは右上へ */
function die(x: number, y: number, front: number, right: number, top?: number): Shape[] {
  const s = 54;
  const [dx, dy] = [22, -22];
  const out: Shape[] = [
    poly(
      [
        [x + s, y],
        [x + s + dx, y + dy],
        [x + s + dx, y + s + dy],
        [x + s, y + s]
      ],
      '#f1ece6'
    ),
    g(`matrix(${dx / s} ${dy / s} 0 1 ${x + s} ${y})`, ...pipDots(right, s)),
    rect(x, y, s, s, '#fff'),
    g(`translate(${x} ${y})`, ...pipDots(front, s))
  ];
  if (top !== undefined)
    out.push(
      poly(
        [
          [x, y],
          [x + s, y],
          [x + s + dx, y + dy],
          [x + dx, y + dy]
        ],
        '#fff'
      ),
      g(`matrix(1 0 ${dx / s} ${dy / s} ${x} ${y})`, ...pipDots(top, s))
    );
  return out;
}

/** 駐車場の地面に塗った字に見せるため、書体ではなく 7 本の棒で数字を描く */
const SEGS = [
  '1111110',
  '0110000',
  '1101101',
  '1111001',
  '0110011',
  '1011011',
  '1011111',
  '1110000',
  '1111111',
  '1111011'
];

function segDigit(x: number, y: number, d: number, w: number): Shape[] {
  const h = 22;
  const ends: [number, number, number, number][] = [
    [0, 0, w, 0],
    [w, 0, w, h / 2],
    [w, h / 2, w, h],
    [0, h, w, h],
    [0, h / 2, 0, h],
    [0, 0, 0, h / 2],
    [0, h / 2, w, h / 2]
  ];
  // 1 を右の 2 本で描くと、さかさまにしたとき片側へ寄ってけたの間が空いて見える
  if (d === 1) return [line(x, y, x, y + h, { stroke: '#fff', 'stroke-width': 3.5 })];
  return ends
    .filter((_, i) => SEGS[d][i] === '1')
    .map(([x1, y1, x2, y2]) => line(x + x1, y + y1, x + x2, y + y2, { stroke: '#fff', 'stroke-width': 3.5 }));
}

const painted = (cx: number, cy: number, n: number) => {
  const ds = String(n).split('').map(Number);
  const ws = ds.map((d): number => (d === 1 ? 0 : 9));
  let x = cx - (ws.reduce((a, b) => a + b, 0) + (ds.length - 1) * 5) / 2;
  const out: Shape[] = [];
  ds.forEach((d, i) => {
    out.push(...segDigit(x, cy - 11, d, ws[i]));
    x += ws[i] + 5;
  });
  return g(`rotate(180 ${cx} ${cy})`, ...out);
};

type P = [number, number];
// 展開図のマス（56 の四角）。★の反対は (2, 2) のハート、丸の反対は (2, 1) の四角（Z 字に並ぶ 4 面の両端）
const NET = { x: 38, y: 16, u: 56 };
const cell = (i: number, j: number): P => [NET.x + i * NET.u, NET.y + j * NET.u];
const mid = (i: number, j: number): P => [NET.x + (i + 0.5) * NET.u, NET.y + (j + 0.5) * NET.u];
const star = (cx: number, cy: number, r: number, fill: string) =>
  poly(
    Array.from({ length: 10 }, (_, k): P => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      return [Math.round((cx + rr * Math.cos(a)) * 10) / 10, Math.round((cy + rr * Math.sin(a)) * 10) / 10];
    }),
    fill
  );
const netFaces: { at: P; mark: (cx: number, cy: number) => Shape }[] = [
  { at: [1, 0], mark: (x, y) => star(x, y, 18, '#ffd166') },
  { at: [0, 0], mark: (x, y) => circle(x, y, 14, '#8ecae6') },
  {
    at: [1, 1],
    mark: (x, y) =>
      poly(
        [
          [x, y - 15],
          [x + 15, y + 12],
          [x - 15, y + 12]
        ],
        '#9ad0a0'
      )
  },
  { at: [2, 1], mark: (x, y) => rect(x - 13, y - 13, 26, 26, '#c3a6e8') },
  {
    at: [2, 2],
    mark: (x, y) =>
      path(
        `M${x} ${y + 14}C${x - 22} ${y} ${x - 12} ${y - 18} ${x} ${y - 7}C${x + 12} ${y - 18} ${x + 22} ${y} ${x} ${y + 14}z`,
        '#ff8fa3'
      )
  },
  {
    at: [3, 2],
    mark: (x, y) =>
      poly(
        [
          [x, y - 17],
          [x + 13, y],
          [x, y + 17],
          [x - 13, y]
        ],
        '#ffae42'
      )
  }
];

const CARDS = ['ね', 'ホ', '8', '3', 'ミ', '5'];
const cardAt = (i: number): P => [60 + (i % 3) * 90, 56 + Math.floor(i / 3) * 102];

const ladder = (x: number, top: number, rungs: number[]) => [
  line(x, top, x, 250, { 'stroke-width': 3 }),
  line(x + 20, top, x + 20, 250, { 'stroke-width': 3 }),
  ...rungs.map((y) => line(x, y, x + 20, y))
];
const RUNGS = Array.from({ length: 10 }, (_, i) => 186 - i * 14);

export default [
  {
    kind: 'number',
    title: '地下からの階段',
    text: 'あるビルの階段を、1階から4階まで上ると36秒かかった。同じ速さで上り続けるとして、地下2階から7階まで上るには何秒かかるだろうか？',
    fig: {
      w: 300,
      h: 140,
      s: [
        rect(0, 124, 300, 16, '#ead7bd', { stroke: 'none' }),
        // 上は切れた眺めにして、4 階建てのビルに見えないようにする
        rect(80, 0, 140, 124, '#fff8ec', { stroke: 'none' }),
        line(80, 0, 80, 124),
        line(220, 0, 220, 124),
        ...[1, 2, 3, 4].map((k) => line(80, 124 - k * 26, 220, 124 - k * 26)),
        line(0, 124, 300, 124, { 'stroke-width': 3 }),
        ...[0, 1, 2].map((k) => {
          const y = 124 - k * 26;
          const toRight = k % 2 === 0;
          const x0 = toRight ? 140 : 210;
          const dir = toRight ? 1 : -1;
          const d =
            `M${x0} ${y}` +
            [0, 1, 2, 3, 4].map((i) => `V${y - (i + 1) * 5.2}H${x0 + dir * (i + 1) * 14}`).join('') +
            `V${y}z`;
          return path(d, '#e8b77a', { 'stroke-width': 1.5 });
        }),
        ...[1, 2, 3, 4].map((k) => text(110, 111 - (k - 1) * 26, `${k}階`, 12))
      ]
    },
    answer: 96,
    unit: '秒',
    hints: [
      '1階から4階まで、階段を何回分上っただろうか？',
      '1階→4階は3回分で、1回分は12秒。階段は階と階の「あいだ」にある。',
      '地下1階のすぐ上は1階。0階はないので、地下2階→1階は2回分しかない。'
    ],
    why: '階段は階と階のあいだにあるので、数えるのは「あいだ」の数。1階→4階は3つで、1つ12秒。地下2階→7階は、地下2階→地下1階→1階の2つと、1階→7階の6つで8つ。0階はないことに気をつけて、12×8＝96秒。'
  },
  {
    kind: 'number',
    title: '満ち潮とはしご',
    text: '岸壁と、そばに浮かぶ船に、はしごが1本ずつ掛かっている。どちらも水面から上に10段出ていて、段の間隔は30cm、いちばん下の段は水面から30cmの高さにある。潮が満ちて水面が1時間に25cmずつ上がると、3時間後に水面より上に出ている段は、2本合わせて何段だろうか？',
    fig: {
      w: 320,
      h: 250,
      s: [
        rect(-4, 52, 94, 210, '#d9d4cf'),
        ...[80, 110, 140, 170].map((y) => line(0, y, 90, y, { stroke: '#bdb5ad' })),
        text(45, 66, '岸壁', 13),
        ...ladder(92, 48, RUNGS),
        rect(196, 26, 60, 26, '#fff', { rx: 6 }),
        rect(206, 32, 12, 12, '#8ecae6', { rx: 3 }),
        rect(226, 32, 12, 12, '#8ecae6', { rx: 3 }),
        poly(
          [
            [174, 52],
            [324, 52],
            [324, 250],
            [190, 250]
          ],
          '#f4a3b5'
        ),
        text(260, 110, '船', 16),
        ...ladder(154, 48, RUNGS),
        path('M150 52h24', 'none', { 'stroke-width': 3 }),
        rect(-4, 200, 328, 54, '#8ecae6', { stroke: 'none', 'fill-opacity': 0.75 }),
        path('M0 200q20 -8 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0', 'none', { stroke: '#4a90b8' })
      ]
    },
    answer: 18,
    unit: '段',
    hints: [
      '2本のはしごは、潮が満ちたとき同じように沈むだろうか？',
      '船は水に浮いているので、水面と一緒に上がる。沈んでいくのは岸壁のはしごだけ。',
      '3時間で水面は75cm上がる。岸壁のはしごでは、30cmと60cmの段が水に沈む。'
    ],
    why: '船は浮いているので、水面が上がれば船もはしごも一緒に上がり、ずっと10段のまま。岸壁は動かないので、水面が75cm上がると30cmと60cmの2段が沈み、残りは8段。合わせて18段。'
  },
  {
    kind: 'slide',
    title: '引っ越しのピアノ',
    text: '荷物でいっぱいの部屋から、ピアノを運び出したい。荷物もピアノも、1 ますずつ縦か横にすべらせることしかできず、持ち上げたり回したりはできない。ピアノを、下の辺の真ん中にある出口の前まで運んでほしい。',
    cols: 4,
    rows: 5,
    blocks: [
      { x: 2, y: 0, w: 2, h: 2, color: '#ffb3c7', label: 'ピアノ' },
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 0, y: 1, w: 2, h: 1 },
      { x: 0, y: 2, w: 1, h: 2 },
      { x: 1, y: 2, w: 1, h: 2 },
      { x: 2, y: 2, w: 2, h: 1 },
      { x: 3, y: 3, w: 1, h: 1 },
      { x: 0, y: 4, w: 2, h: 1 }
    ],
    target: 0,
    goal: { x: 1, y: 3 },
    hints: [
      'ピアノをいきなり真ん中へ寄せようとすると、荷物がつかえて行きづまる。',
      'ピアノは右の 2 列を通り道にして、右に寄せたまま 1 段ずつ下ろせる。空いた右上には左の横長の荷物を送り込む。',
      'ピアノを右に寄せたまま、いちばん下の段まで下ろしきろう。真ん中へ寄せるのは最後の 1 手だけでよい。'
    ],
    why: '出口が真ん中にあるので、先にピアノを真ん中へ寄せたくなる。だが左の列には縦長の荷物が並び、寄せると身動きが取れない。右の 2 列を通り道にして 1 段ずつ下ろし、ピアノの上に空いた場所へ左の荷物を順に逃がす。底まで下りたら左へ 1 ます。'
  },
  {
    kind: 'river',
    title: '親子の川渡り',
    text: 'ボートには重さの制限があり、乗れるのは大人なら1人、子どもなら2人まで。大人と子どもが一緒に乗ると、重すぎて沈んでしまう。誰でもこげるが、ボートだけを渡らせることはできない。両親と2人の子ども、4人全員を向こう岸へ渡してほしい。',
    crossers: [
      { id: 'papa', name: '父', icon: 'adult', color: '#8ecae6', weight: 2 },
      { id: 'mama', name: '母', icon: 'adult', color: '#f4a3b5', weight: 2 },
      { id: 'sora', name: 'ソラ', icon: 'kid', color: '#9ad0a0' },
      { id: 'hana', name: 'ハナ', icon: 'kid', color: '#ffd166' }
    ],
    cap: 2,
    hints: [
      '大人が渡ったあと、ボートを戻すのは誰だろうか？',
      '向こう岸に子どもが1人待っていれば、その子がボートを戻してくれる。',
      'まず子ども2人で渡り、1人が戻る。それから大人が1人で渡る。'
    ],
    why: '子ども2人で渡り、1人が戻る。大人が渡り、向こうで待っていた子どもがボートを戻す。これで大人が1人渡り、子ども2人は元の岸に戻った。もう一度くり返して2人目の大人を渡し、最後に子ども2人で渡れば全員そろう。'
  },
  {
    kind: 'number',
    title: '拾った新聞',
    text: 'ばらばらになった新聞から、紙を1枚拾った。広げると、片面に10ページと27ページが並んでいた。この新聞は、何枚かの紙を重ねて真ん中で2つに折ったもので、紙1枚に4ページずつ、1ページから順に番号がついている。全部で何ページだろうか？',
    fig: {
      w: 300,
      h: 170,
      s: [
        rect(20, 16, 260, 140, '#fff'),
        line(150, 16, 150, 156, { 'stroke-dasharray': '5 4' }),
        ...[0, 1].flatMap((side) => {
          const x = 20 + side * 130;
          return [
            rect(x + 14, 30, 102, 22, '#dfe9f3', { stroke: 'none', rx: 3 }),
            rect(x + 14, 60, 60, 44, '#f4d6c6', { stroke: 'none', rx: 3 }),
            ...[62, 74, 86, 98, 112, 124].map((y) =>
              line(y < 104 ? x + 82 : x + 14, y, x + 116, y, { stroke: '#d9d4cf', 'stroke-width': 4 })
            ),
            text(side ? x + 106 : x + 24, 142, side ? '27' : '10', 13)
          ];
        })
      ]
    },
    answer: 36,
    unit: 'ページ',
    hints: [
      '紙1枚の表と裏に、4つのページが載っている。この紙に載っている、残りの2ページは何ページだろう？',
      '同じ面に並ぶ2ページは、前から数えた位置と、後ろから数えた位置が同じになる。',
      '10ページは前から10番目。だから27ページは後ろから10番目にある。'
    ],
    why: '紙を重ねて折ると、同じ面に並ぶ2ページは、前から数えた位置と後ろから数えた位置がそろう。10ページは前から10番目なので、27ページは後ろから10番目。27の後ろにあと9ページあって、全部で36ページ。この紙には9・10・27・28ページが載っている。'
  },
  {
    kind: 'tap',
    title: '★の裏側',
    text: 'この展開図を組み立てて立方体にする。★の面と向かい合う面、丸の面と向かい合う面は、それぞれどれだろうか？ その2つの面を選んでほしい。',
    fig: {
      w: 300,
      h: 200,
      s: netFaces.flatMap(({ at, mark }) => [rect(...cell(...at), NET.u, NET.u, '#fff8ec'), mark(...mid(...at))])
    },
    spots: netFaces.slice(1).map(({ at }) => {
      const [x, y] = mid(...at);
      return { x, y, r: 22 };
    }),
    answer: [2, 3],
    hints: [
      '組み立てたとき、辺を接している面どうしは向かい合わない。',
      '1枚の面を底に決めて、残りを1枚ずつ折り上げていこう。展開図でZ字に並んだ4面は、両端が向かい合う。',
      '★・三角・四角・ハートの4面はZ字に並んでいる。丸・★・三角・四角もZ字だ。'
    ],
    why: '三角を底にすると、★は奥の壁、四角は右の壁に立つ。★の左の丸は左の壁に、四角の下のハートは手前の壁に回りこむ。だから★の裏はハート、丸の裏は四角。展開図でZ字に並んだ4面は両端が向かい合う、と覚えておくと早い。'
  },
  {
    kind: 'number',
    title: '積まれたさいころ',
    text: '3つのさいころを積み重ねて机に置いた。この向きから見えない面の目を、すべて足すといくつになるだろうか？ 机に接した面や、さいころどうしが重なった面も数に入れる。',
    fig: {
      w: 300,
      h: 250,
      s: [
        rect(20, 222, 260, 20, '#e8b77a', { rx: 4 }),
        ...die(110, 168, 6, 2),
        ...die(110, 114, 5, 4),
        ...die(110, 60, 2, 3, 1)
      ]
    },
    answer: 40,
    unit: '',
    hints: [
      '見えない面を1つずつ推理しなくてもよい。',
      'さいころ1つの目をすべて足すと、1＋2＋…＋6＝21。3つなら63。',
      '63から、見えている7つの面の目を引けばよい。'
    ],
    why: '見えない面の目を1つずつ決めるのは難しいが、さいころ3つの目の合計は21×3＝63と決まっている。見えているのは上の1、正面の2・5・6、右側の3・4・2で合計23。63−23＝40。'
  },
  {
    kind: 'pour',
    title: '10リットルを二等分',
    text: '10リットル入る容器に水がいっぱい。空の7リットルと3リットルの容器もある。目盛りはなく、注ぐときは注ぐ側が空になるか、受ける側がいっぱいになるまで。10リットルと7リットルの容器に、5リットルずつ分けてほしい。',
    caps: [10, 7, 3],
    start: [10, 0, 0],
    goal: (a) => a[0] === 5 && a[1] === 5,
    hints: [
      '7リットルの容器を満たし、3リットルで汲み出すと、7の容器に何が残る？',
      '汲み出した3リットルは10の容器に戻す。7の容器には4、1と端数が残っていく。',
      '3の容器に1だけ入れておけば、満タンの7から2だけ注げて、7に5が残る。'
    ],
    why: '10→7、7→3、3→10、7→3、3→10で、7の容器に1が残る。それを3の容器へ移し、10→7で7を満タンにする。3の容器はあと2しか入らないので、7→3で7の容器に5が残る。3→10で10の容器も5。'
  },
  {
    kind: 'number',
    title: '駐車場の番号',
    text: '駐車場の区画に番号が書かれている。1台の車が止まっていて、その下の番号が隠れてしまった。隠れているのは何番だろうか？',
    fig: {
      w: 300,
      h: 190,
      s: [
        rect(0, 0, 300, 190, '#b9b3ad', { stroke: 'none' }),
        path('M62 14v18m-8 -8l8 8l8 -8', 'none', { stroke: '#fff', 'stroke-width': 3 }),
        ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
          line(18 + i * 44, 50, 18 + i * 44, 170, { stroke: '#fff', 'stroke-width': 3 })
        ),
        line(18, 170, 282, 170, { stroke: '#fff', 'stroke-width': 3 }),
        ...[110, 109, 108, 107, 106, 105].map((n, i) => painted(40 + i * 44, 76, n)),
        rect(156, 58, 32, 100, '#ff8fa3', { rx: 10 }),
        rect(160, 76, 24, 18, '#dff3fb', { rx: 4 }),
        rect(160, 126, 24, 14, '#dff3fb', { rx: 4 })
      ]
    },
    answer: 107,
    unit: '番',
    hints: [
      '順に並んだ番号にしては、ばらばらに見える。書かれた向きに注目しよう。',
      '車は上の通路から入ってくる。運転する人の側から見ると、番号はどう読める？',
      'いま右端に「501」と見える区画は、向こうからは105。その左隣が106だ。'
    ],
    why: '番号は、上の通路から入ってくる車のために書かれていて、こちらからは上下が逆さまに見える。逆さにして読むと、こちらの右端から105、106、□、108、109、110。隠れているのは107番。'
  },
  {
    kind: 'tap',
    title: '決まりを確かめる',
    text: 'どのカードも、片面にひらがなかカタカナ、もう片面に数字が1つ書いてある。「ひらがなのカードの裏は、必ず偶数」という決まりが守られているか確かめたい。めくる枚数をできるだけ少なくするには、どのカードをめくればよいか。めくるカードをすべて選んでほしい。',
    fig: {
      w: 300,
      h: 214,
      s: CARDS.flatMap((t, i) => {
        const [x, y] = cardAt(i);
        return [rect(x - 34, y - 44, 68, 88, '#fff', { rx: 8 }), text(x, y, t, 34)];
      })
    },
    spots: CARDS.map((_, i) => {
      const [x, y] = cardAt(i);
      return { x, y, r: 28 };
    }),
    answer: [0, 3, 5],
    hints: [
      '決まりが「破れている」のは、どんなカードだろうか？',
      '破れるのは「ひらがなの裏が奇数」のカードだけ。偶数の裏に何が書いてあっても、決まりには反しない。',
      '破れたカードが隠れているかもしれないのは、ひらがなの裏と、奇数の裏。'
    ],
    why: '決まりが破れるのは「ひらがなの裏が奇数」のときだけ。だから確かめるのは、ひらがなの「ね」の裏と、奇数の「3」と「5」の裏。つい「8」もめくりたくなるが、8の裏がカタカナでも決まりには反しない。カタカナのカードも同じで、めくらなくてよい。'
  }
] satisfies Puzzle[];
