import { equation } from '../engine';
import { circle, g, icon, line, LINE, path, poly, rect, text } from '../fig';
import type { Puzzle } from '../types';

const PINK = '#e2557a';

/** (x, 地面の y) に立つ ろうそく。高さ h、lit なら火を灯す */
const candle = (x: number, y: number, h: number, lit: boolean) =>
  g(
    `translate(${x} ${y})`,
    rect(-10, -h, 20, h, '#fff3c4', { rx: 4 }),
    line(0, -h, 0, -h - 7),
    ...(lit ? [path(`M0 ${-h - 32}q12 14 9 22a9 9 0 0 1 -18 0q-3 -8 9 -22z`, '#ffb347')] : [])
  );

const bubble = (x: number, y: number, t1: string, t2: string) =>
  g(
    `translate(${x} ${y})`,
    rect(-50, -22, 100, 44, '#fff', { rx: 16 }),
    poly(
      [
        [-6, 21],
        [6, 21],
        [0, 32]
      ],
      '#fff',
      { stroke: 'none' }
    ),
    line(-6, 22, 0, 32),
    line(6, 22, 0, 32),
    text(0, -9, t1, 13),
    text(0, 10, t2, 13)
  );

/** 左右どちらかを向いた矢印（線と三角の頭） */
const arrow = (x1: number, x2: number, y: number) => {
  const d = Math.sign(x2 - x1);
  return g(
    'translate(0 0)',
    line(x1, y, x2 - d * 6, y, { 'stroke-width': 3 }),
    poly(
      [
        [x2, y],
        [x2 - d * 12, y - 7],
        [x2 - d * 12, y + 7]
      ],
      LINE
    )
  );
};

// グラスのマッチ棒は半本ずらした置き場所も要るので、座標を半本（HALF）単位で決める
const HALF = 35;
const at = (x: number, y: number) => ({ x: 115 + x * HALF, y: 110 + y * HALF });
const stick = (x: number, y: number, vertical: boolean) => {
  const a = at(x, y);
  const b = vertical ? at(x, y + 2) : at(x + 2, y);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
};
/**
 * 空いた置き場所の点線は棒より後に描かれるので、はじめに底がある x = 0 を横の最後に置き、点線が底に重ならないようにする。
 * 底の上の段（y -2..0）の縦は、さくらんぼを貫く x = 1 を置かない
 */
const glass = [
  ...[-1, 1, 0].map((x) => stick(x, 0, false)),
  ...[-1, 0, 2, 3].map((x) => stick(x, -2, true)),
  ...[-1, 0, 1, 2, 3].map((x) => stick(x, 0, true))
];
const CHERRY = { x: 150, y: 93 };

/** 4 本が、底・底の両端から同じ側へ立つ 2 本・底の中ほどから反対側へ出る脚、の形で、さくらんぼが器の外にある */
function cherryOut(on: ReadonlySet<number>) {
  const ss = [...on].map((i) => glass[i]);
  if (ss.length !== 4) return false;
  const has = (x1: number, y1: number, x2: number, y2: number) =>
    ss.some(
      (s) =>
        (s.x1 === x1 && s.y1 === y1 && s.x2 === x2 && s.y2 === y2) ||
        (s.x1 === x2 && s.y1 === y2 && s.x2 === x1 && s.y2 === y1)
    );
  return ss.some((base) =>
    [1, -1].some((side) => {
      const [nx, ny] = base.y1 === base.y2 ? [0, side * 2 * HALF] : [side * 2 * HALF, 0];
      const [mx, my] = [(base.x1 + base.x2) / 2, (base.y1 + base.y2) / 2];
      if (
        !has(base.x1, base.y1, base.x1 + nx, base.y1 + ny) ||
        !has(base.x2, base.y2, base.x2 + nx, base.y2 + ny) ||
        !has(mx, my, mx - nx, my - ny)
      )
        return false;
      const xs = [base.x1, base.x2, base.x1 + nx];
      const ys = [base.y1, base.y2, base.y1 + ny];
      const inCup =
        CHERRY.x >= Math.min(...xs) &&
        CHERRY.x <= Math.max(...xs) &&
        CHERRY.y >= Math.min(...ys) &&
        CHERRY.y <= Math.max(...ys);
      return !inCup;
    })
  );
}

const eq7 = equation('5+7=18');

/** 下から順に重ねる。いちばん大きい黄色が下じきに見えるが、水色の角がその下にもぐっている */
const papers: [number, number, number, number, string][] = [
  [110, 60, 110, 80, '#a8d8ff'],
  [20, 20, 150, 110, '#ffe08a'],
  [130, 110, 100, 90, '#ffb3c7'],
  [200, 150, 90, 62, '#b5e6a8'],
  [240, 40, 55, 140, '#d7c2f2'],
  [180, 8, 75, 45, '#ffc9a0'],
  [40, 160, 130, 55, '#a8e6df']
];

// 4×4 のマスから、中央 2×2 の中の十字の仕切りだけを抜いた図
const U = 45;
const X0 = 60;
const Y0 = 10;
const gx = (i: number) => X0 + i * U;
const gy = (j: number) => Y0 + j * U;

export default [
  {
    kind: 'number',
    title: '列車とトンネル',
    text: '長さ 500m の列車が、時速 60km で長さ 1.5km のトンネルを通り抜ける。列車の先頭がトンネルに入ってから、最後尾がトンネルを出るまでに何分かかるだろうか？',
    fig: {
      w: 300,
      h: 160,
      s: [
        poly(
          [
            [118, 112],
            [178, 30],
            [236, 22],
            [298, 112]
          ],
          '#b5e6a8'
        ),
        rect(150, 84, 135, 28, '#e3f3dc', { 'stroke-dasharray': '5 4' }),
        path('M142 112v-22a14 14 0 0 1 16 -14v36z', '#8f7f77'),
        line(0, 112, 300, 112, { 'stroke-width': 3 }),
        path('M96 108v-16a4 4 0 0 1 4 -4h32q10 0 10 10v10z', '#a8d8ff'),
        ...[104, 116, 128].map((x) => rect(x - 4, 92, 8, 7, '#fff', { 'stroke-width': 1.5 })),
        line(96, 128, 142, 128),
        line(96, 122, 96, 134),
        line(142, 122, 142, 134),
        text(119, 146, '500m', 13),
        line(150, 128, 285, 128),
        line(150, 122, 150, 134),
        line(285, 122, 285, 134),
        text(218, 146, 'トンネル 1.5km', 13)
      ]
    },
    answer: 2,
    unit: '分',
    hints: [
      '時速 60km は、1 分間に何 km 進む速さだろうか。',
      '先頭が出口に着いた瞬間、列車の後ろのほうはまだトンネルの中にある。',
      '最後尾が出るまでに先頭が進む距離は、トンネルの長さに列車の長さを足したものだ。'
    ],
    why: '時速 60km は 1 分で 1km。先頭が出口に着くまでに 1.5km、そこから最後尾が抜けるまでに列車の長さの 0.5km を進む。合わせて 2km だから 2 分だ。'
  },
  {
    kind: 'number',
    title: '抜きつ抜かれつ',
    text: 'マラソン大会の終盤、あなたは 2 位の走者を抜き去った。ところがその直後、3 位の走者に抜かれてしまった。いま、あなたは何位だろうか？',
    fig: {
      w: 300,
      h: 150,
      s: [
        rect(0, 70, 300, 60, '#f6c9a6', { stroke: 'none' }),
        line(0, 70, 300, 70, { stroke: '#fff', 'stroke-width': 3 }),
        line(0, 130, 300, 130, { stroke: '#fff', 'stroke-width': 3 }),
        line(262, 64, 262, 136, { stroke: '#fff', 'stroke-width': 6, 'stroke-dasharray': '6 6' }),
        icon('kid', 210, 100, 48),
        text(210, 50, '1位', 16),
        icon('kid', 140, 100, 48),
        text(140, 50, '2位', 16),
        circle(80, 100, 28, '#ffd6e0', { stroke: PINK }),
        icon('kid', 80, 100, 48),
        text(80, 50, 'あなた', 16, { fill: PINK }),
        path('M62 130q46 22 94 0', 'none', { stroke: PINK, 'stroke-width': 3, 'stroke-dasharray': '5 4' }),
        poly(
          [
            [156, 130],
            [146, 124],
            [148, 136]
          ],
          PINK,
          { stroke: PINK }
        )
      ]
    },
    answer: 3,
    unit: '位',
    hints: [
      '2 位の走者を抜いた瞬間、あなたは何位になっただろうか。',
      '1 位の走者を抜いたわけではない。抜いた相手と順位を入れ替えただけだ。',
      '2 位のあなたを 3 位の走者が抜けば、順位はもう一度入れ替わる。'
    ],
    why: '2 位を抜いても 1 位にはならない。相手と入れ替わって 2 位になっただけだ。そのすぐ後ろの 3 位に抜かれれば、また入れ替わって 3 位。「抜いて 1 位、抜かれて 2 位」と考えるとつまずく。'
  },
  {
    kind: 'tap',
    title: '重なった色紙',
    text: '7 枚の色紙を、1 枚ずつ机の上に重ねて置いていった。最初に置いた 3 枚はどれだろうか？ その 3 枚をタップしてほしい。',
    fig: {
      w: 300,
      h: 220,
      s: papers.map(([x, y, w, h, fill]) => rect(x, y, w, h, fill, { rx: 4 }))
    },
    spots: [
      { x: 196, y: 84, r: 20 },
      { x: 74, y: 74, r: 24 },
      { x: 176, y: 136, r: 22 },
      { x: 222, y: 190, r: 20 },
      { x: 268, y: 90, r: 22 },
      { x: 204, y: 30, r: 20 },
      { x: 70, y: 188, r: 22 }
    ],
    answer: [0, 1, 2],
    hints: [
      '2 枚が重なっている所では、ふちが上に見えている紙のほうがあとから置かれている。',
      'いちばん大きな黄色の紙にも、その下にもぐっている紙がある。',
      '水色、黄色の順に置かれている。3 枚目は、その 2 枚の上にじかにのっている紙だ。'
    ],
    why: '水色の角は黄色の下にもぐっているので、水色が 1 番目、黄色が 2 番目。その 2 枚の上にのっているピンクが 3 番目。緑と青緑はピンクの上に、紫は緑の上に、オレンジは紫の上に置かれている。'
  },
  {
    kind: 'number',
    title: '燃えさしのろうそく',
    text: 'ろうそくは 1 本で 1 時間燃え、燃え尽きると小さな燃えさしが残る。燃えさしを 4 つ集めて溶かせば、新しいろうそくが 1 本できる。ろうそく 16 本を 1 本ずつ灯していくと、最長で何時間明かりを保てるだろうか？',
    fig: {
      w: 300,
      h: 150,
      s: [
        rect(10, 112, 280, 10, '#d9c2a7', { rx: 5 }),
        candle(45, 112, 60, true),
        text(45, 138, '1本で1時間', 13),
        ...[105, 130, 155, 180].map((x) => candle(x, 112, 14, false)),
        text(142, 138, '燃えさし 4つ', 13),
        arrow(202, 230, 90),
        candle(252, 112, 60, false),
        text(252, 138, '新しい1本', 13)
      ]
    },
    answer: 21,
    unit: '時間',
    hints: [
      '作り直したろうそくも、燃やせばまた燃えさしが残る。',
      '16 本を燃やすと燃えさしが 16 個。そこから何本作れるだろうか。',
      '16 個から 4 本。その 4 本が燃え尽きたあとの燃えさしで、もう 1 本作れる。'
    ],
    why: 'まず 16 本で 16 時間。燃えさし 16 個から 4 本作って 4 時間。その 4 本の燃えさしから 1 本作って 1 時間。合わせて 21 時間だ。作り直したろうそくの燃えさしを忘れると 20 時間で止まってしまう。'
  },
  {
    kind: 'sticks',
    title: 'グラスのさくらんぼ',
    text: 'マッチ棒 4 本でグラスを作り、中にさくらんぼを入れた。マッチ棒を 2 本だけ動かして、さくらんぼをグラスの外に出してほしい。さくらんぼには触れず、グラスの形も崩さないこと。ただし、グラスの向きは変わってもかまわない。',
    fig: {
      w: 300,
      h: 220,
      s: [
        path(`M${CHERRY.x} ${CHERRY.y - 12}q2 -14 12 -22`, 'none', { 'stroke-width': 2.5 }),
        path(`M${CHERRY.x + 12} ${CHERRY.y - 34}q12 -4 16 6q-12 4 -16 -6z`, '#9ad0a0'),
        circle(CHERRY.x, CHERRY.y, 13, '#ff6b7f'),
        circle(CHERRY.x - 4, CHERRY.y - 4, 3, '#fff', { stroke: 'none' })
      ]
    },
    slots: glass,
    on: [2, 4, 5, 9],
    moves: 2,
    goal: cherryOut,
    hints: [
      'さくらんぼを動かせないのなら、グラスのほうを動かすしかない。',
      'グラスの向きは変わってもよい。逆さまに伏せたグラスを思い浮かべてみよう。',
      '底の棒を横へ半分だけずらしてみよう。すると、脚だった棒が何かに見えてこないだろうか。'
    ],
    why: '底の棒を左へ半分ずらすと、脚だった棒が底の右端から下へ伸びる側面になる。右の側面を底の左端の下へ移せば、器は下向きになり、左の側面が上へ伸びる脚になる。グラスは逆さまに伏せられ、さくらんぼは外に残る。'
  },
  {
    kind: 'number',
    title: '花子のきょうだい',
    text: '花子が自分のきょうだいを数えると、男の子と女の子が同じ人数いる。ところが兄の太郎が自分のきょうだいを数えると、女の子は男の子のちょうど 2 倍だという。この家の子どもは全部で何人だろうか？',
    fig: {
      w: 300,
      h: 150,
      s: [
        icon('kid', 90, 94, 50),
        bubble(90, 30, 'きょうだいは', '男女が同じ数'),
        text(90, 136, '花子', 14),
        icon('kid', 210, 94, 50),
        bubble(210, 30, 'きょうだいは', '女が男の2倍'),
        text(210, 136, '太郎', 14)
      ]
    },
    answer: 7,
    unit: '人',
    hints: [
      '自分自身は、自分のきょうだいには数えない。',
      '花子から見ると女の子が 1 人減り、太郎から見ると男の子が 1 人減る。',
      '男の子が 3 人だとしたら、女の子は何人になるだろうか。両方の言葉に合うか確かめよう。'
    ],
    why: '男の子 3 人、女の子 4 人なら、花子から見たきょうだいは男 3 人と女 3 人で同じ数。太郎から見ると男 2 人と女 4 人で、女がちょうど 2 倍。自分を数えないことに気づけば 7 人とわかる。'
  },
  {
    kind: 'sticks',
    title: 'マッチ棒の計算',
    text: 'マッチ棒で書いたこの式は正しくない。マッチ棒を 1 本だけ動かして、正しい式にしてほしい。',
    fig: { w: eq7.width, h: eq7.height, s: [] },
    slots: eq7.slots,
    on: eq7.on,
    moves: 1,
    goal: eq7.goal,
    hints: [
      '左側の数字だけをいじっても、18 には届きそうにない。',
      '動かす棒は、答えの側の数字から借りてきてもよい。',
      '8 から 1 本抜けば 6 にも 9 にも 0 にもなる。抜いた棒は左の数字に足せないだろうか。'
    ],
    why: '18 の 8 から右上の棒を抜くと 6 になり、答えは 16。その棒を 5 の右上に足すと 9 になり、9 + 7 = 16 が成り立つ。式の左側だけでなく、答えの側も動かせるのがこのナゾの鍵だ。'
  },
  {
    kind: 'river',
    title: 'イヌも乗せる川渡り',
    text: 'オオカミ・ヒツジ・キャベツ・イヌを連れて川を渡りたい。舟をこげるのはあなただけで、あなたのほかに 2 つまで乗せられる。あなたのいない岸では、オオカミはヒツジとイヌに、イヌはヒツジに、ヒツジはキャベツに手を出してしまう。',
    crossers: [
      { id: 'you', name: 'あなた', icon: 'adult', color: '#ffe08a', rows: true },
      { id: 'wolf', name: 'オオカミ', icon: 'wolf', color: '#c9c3cf' },
      { id: 'sheep', name: 'ヒツジ', icon: 'sheep', color: '#fff6e6' },
      { id: 'cabbage', name: 'キャベツ', icon: 'cabbage', color: '#b5e6a8' },
      { id: 'dog', name: 'イヌ', icon: 'dog', color: '#f6c9a6' }
    ],
    cap: 3,
    danger: (bank) => {
      if (bank.has('you')) return null;
      if (bank.has('wolf') && bank.has('sheep')) return 'オオカミがヒツジに襲いかかってしまった';
      if (bank.has('wolf') && bank.has('dog')) return 'オオカミとイヌがけんかを始めてしまった';
      if (bank.has('dog') && bank.has('sheep')) return 'イヌがヒツジを追い回してしまった';
      if (bank.has('sheep') && bank.has('cabbage')) return 'ヒツジがキャベツを食べてしまった';
      return null;
    },
    hints: [
      '一度向こう岸へ運んだものを、連れて戻ってもかまわない。',
      'けんかの種が多いのはオオカミとヒツジだ。まずこの 2 つを一緒に運んでみよう。',
      'オオカミを連れ戻し、キャベツと一緒にもう一度渡る。次に連れ戻すのはヒツジだ。'
    ],
    why: 'オオカミとヒツジを運び、オオカミだけ連れ戻す。オオカミとキャベツを運び、今度はヒツジを連れ戻す。最後にヒツジとイヌを運べば、5 回で全員が渡れる。運んだものを連れ戻すのが鍵だ。'
  },
  {
    kind: 'number',
    title: '正方形はいくつ？',
    text: 'この図の中に、正方形はいくつあるだろうか？ 大きさの違う正方形も、ほかと重なっている正方形も、すべて数えてほしい。',
    fig: {
      w: 300,
      h: 200,
      s: [
        rect(gx(0), gy(0), 4 * U, 4 * U, '#fff6e6', { 'stroke-width': 3 }),
        ...[1, 3].flatMap((i) => [
          line(gx(i), gy(0), gx(i), gy(4), { 'stroke-width': 3 }),
          line(gx(0), gy(i), gx(4), gy(i), { 'stroke-width': 3 })
        ]),
        line(gx(2), gy(0), gx(2), gy(1), { 'stroke-width': 3 }),
        line(gx(2), gy(3), gx(2), gy(4), { 'stroke-width': 3 }),
        line(gx(0), gy(2), gx(1), gy(2), { 'stroke-width': 3 }),
        line(gx(3), gy(2), gx(4), gy(2), { 'stroke-width': 3 })
      ]
    },
    answer: 18,
    unit: '個',
    hints: [
      'まん中の 4 マスぶんは、仕切りのない 1 つの大きなマスになっている。',
      'まん中の仕切りがないせいで、4 辺がそろわなくなった 2×2 の正方形がある。',
      '小さい正方形は 12 個。2×2 で 4 辺がそろっているのは、実は 1 つだけだ。'
    ],
    why: '小さい正方形は 16 − 4 で 12 個。2×2 はまん中の大きなマス 1 つだけで、ほかは中央の仕切りが欠けて辺がそろわない。3×3 は 4 つとも無事で、全体が 1 つ。12 + 1 + 4 + 1 で 18 個だ。'
  },
  {
    kind: 'lines',
    title: '9つの点',
    text: '9 つの点が縦横 3 つずつ並んでいる。ペンを紙から離さずに 4 本の直線を続けて引き、9 つの点をすべて通してほしい。線を曲げられるのは、うすい目印の上だけだ。',
    fig: { w: 300, h: 250, s: [] },
    dots: [1, 2, 3].flatMap((j) => [1, 2, 3].map((i) => ({ x: 50 + 50 * i, y: 25 + 50 * j }))),
    pegs: [0, 1, 2, 3, 4].flatMap((j) => [0, 1, 2, 3, 4].map((i) => ({ x: 50 + 50 * i, y: 25 + 50 * j }))),
    segments: 4,
    hints: [
      '何度引いても、最後に点が 1 つ残ってしまわないだろうか。',
      '線を曲げる場所を、点の並ぶ四角い枠の中だけで探していないだろうか。',
      '目印は点の枠の外にもある。角の点から斜めに引き、枠の外で折り返してみよう。'
    ],
    why: '枠の中だけで曲げると、4 本ではどうしても点が 1 つ余る。角から斜めに引いて枠の外まで伸ばし、そこで折り返せば 4 本で 9 つを通れる。枠を決めていたのは問題ではなく、自分の思い込みだったのだ。'
  }
] satisfies Puzzle[];
