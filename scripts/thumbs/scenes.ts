import type { Clip, Point, Stage } from './stage.ts';

export interface Scene {
  id: string;
  /** 1 人用で遊ぶレベル。ページを開く前に到達レベルとして保存し、タイトルでこのレベルが選ばれるようにする */
  level?: number;
  /** 撮る範囲（CSS px）。幅 : 高さ = 680 : 400 */
  clip: Clip;
  play: (s: Stage) => Promise<void>;
}

/** 幅いっぱいで、上端 y から 680 : 400 の高さを切り出す */
const band = (y: number): Clip => ({ x: 0, y, width: 768, height: Math.round((768 * 400) / 680) });

const circle = (cx: number, cy: number, r: number): Point[] =>
  Array.from({ length: 27 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const wave = (x0: number, y0: number, length: number): Point[] =>
  Array.from({ length: 13 }, (_, i) => [x0 + (i / 12) * length, y0 + Math.sin(i / 2) * 18]);

/** 描いて離す（らくがきムシ・線を引いて守る） */
async function stroke(s: Stage, path: Point[], ms: number): Promise<void> {
  await s.drag(1, path, ms);
  await s.touch(1, 'up', ...path[path.length - 1]);
}

/**
 * せめぎあい。玉は乱数で出るので、手前の玉が 3 つ（1 つは長押しの玉）と境界の金の玉がそろい、
 * どれも出きって重なっていない瞬間を待つ。重なった玉や消えかけの玉は 1P がはじいて入れ替え、
 * 境界線が動かないよう 2P も同じ数だけはじく
 */
async function borderRush(s: Stage): Promise<void> {
  await s.startDuel();
  let popped = 0;
  for (let i = 0; i < 200 && popped < 4; i++) {
    await s.wait(150);
    const [orb] = await s.centers('.orb.tap.p1');
    if (orb) {
      await s.tap(1, ...orb);
      popped++;
    }
  }
  if (popped < 4) throw new Error('border-rush: 手前の玉が 4 つ出てこない');
  let ready = false;
  for (let i = 0; i < 2000 && !ready; i++) {
    await s.wait(50);
    const state = await s.page.evaluate(() => {
      const age = (el: Element) => Number(el.getAnimations()[0]?.currentTime ?? 0);
      const at = (el: Element) => {
        const r = el.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2] as const;
      };
      const near = (a: Element, b: Element) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1]) < 110;
      const mine = [...document.querySelectorAll('.orb.p1')];
      const gold = [...document.querySelectorAll('.contest')];
      const all = [...mine, ...gold];
      // 出てくる途中（寿命の 10%）と消えかけ（80%）を避ける
      const grown = (el: Element) => age(el) > 260 && age(el) < 2000;
      const stale = mine.filter(
        (el) => el.matches('.tap') && age(el) > 260 && (age(el) > 1800 || all.some((o) => o !== el && near(o, el)))
      );
      const line = gold[0] ? at(gold[0])[1] : 0;
      const ready =
        !stale.length &&
        mine.length === 3 &&
        mine.some((el) => el.matches('.hold')) &&
        mine.every((el) => grown(el) && at(el)[1] < line + 320) &&
        gold.length === 1 &&
        grown(gold[0]);
      const theirs = [...document.querySelectorAll('.orb.tap.p2')].filter((el) => age(el) > 260);
      return { ready, stale: stale.map(at), theirs: theirs.map(at) };
    });
    ready = state.ready;
    if (!ready && state.stale.length && state.theirs.length) {
      await s.tap(1, ...state.stale[0]);
      await s.tap(2, ...state.theirs[0]);
    }
  }
  if (!ready) throw new Error('border-rush: 手前の玉 3 つと金の玉がそろう瞬間が来ない');
  const holds = await s.centers('.orb.hold.p1');
  await s.touch(1, 'down', ...holds[holds.length - 1]);
  // 長押しは 700ms でたまるので、輪が半分ほどたまったところ
  await s.wait(350);
}

/**
 * ばくだんリレー。止まった爆弾を陣地の側の人がつかんで 1 秒持ち、相手へはじく。
 * 爆弾が熱くなってから 1P がはじいたら、境界線を越えるところで止める
 */
async function bombRelay(s: Stage): Promise<void> {
  await s.startDuel();
  const bomb = () =>
    s.page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.bomb');
      if (!el || getComputedStyle(el).opacity === '0') return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, heat: Number(el.style.getPropertyValue('--heat') || 0) };
    });
  let last: Awaited<ReturnType<typeof bomb>> = null;
  for (let i = 0; i < 300; i++) {
    await s.wait(100);
    const b = await bomb();
    const still = b && last && Math.hypot(b.x - last.x, b.y - last.y) < 2;
    last = b;
    if (!b || !still) continue;
    const p = b.y > 512 ? 1 : 2;
    await s.touch(p, 'down', b.x, b.y);
    await s.wait(1000);
    const held = await bomb();
    if (!held) {
      // 持っているあいだに爆発した
      await s.touch(p, 'up', b.x, b.y);
      continue;
    }
    const dir = p === 1 ? -1 : 1;
    for (let k = 1; k <= 4; k++) {
      await s.touch(p, 'move', b.x, b.y + dir * 40 * k);
      await s.wait(16);
    }
    await s.touch(p, 'up', b.x, b.y + dir * 160);
    if (p === 1 && held.heat >= 0.55) {
      await s.wait(120);
      return;
    }
    last = null;
  }
  throw new Error('bomb-relay: 熱くなった爆弾を 1P がはじく場面が来ない');
}

/** 虫送り。手前の陣地を端から叩いていき、虫が 1 匹向こうへ飛んだところで止める */
async function bugRush(s: Stage): Promise<void> {
  await s.startDuel();
  await s.wait(6000);
  const mine = () => s.page.evaluate(() => Number(document.querySelector('.count.p1 .num')?.textContent));
  const before = await mine();
  for (let y = 580; y < 980; y += 50) {
    for (let x = 60; x < 720; x += 50) {
      await s.touch(1, 'down', x, y);
      await s.touch(1, 'up', x, y);
      if ((await mine()) < before) {
        await s.wait(180);
        return;
      }
    }
  }
  throw new Error('bug-rush: 手前の陣地に叩ける虫がいない');
}

/** ライトニング。スワイプの指示が出るまで回を送り、出たら 1P の指を置いて動かし始める */
async function lightning(s: Stage): Promise<void> {
  await s.startDuel();
  let swipe = false;
  for (let i = 0; i < 400 && !swipe; i++) {
    await s.wait(50);
    const label = await s.page.evaluate(() => document.querySelector('.slot.p1 .card.go .label')?.textContent);
    swipe = label === 'スワイプ';
  }
  if (!swipe) throw new Error('lightning: スワイプの指示が出ない');
  // 指示の札が跳ねて出る動き（260ms）が終わりきってから
  await s.wait(400);
  await s.touch(1, 'down', 420, 800);
  await s.wait(16);
  await s.touch(1, 'move', 424, 820);
  await s.wait(16);
}

/**
 * 座標は iPad 縦（768 × 1024）で撮った画面から読んだ CSS px。
 * 盤面が画面の縦いっぱいに広がるゲームは 680 : 400 に全体が入らないので、場面の要になるところを切り出す
 */
export const SCENES: Scene[] = [
  {
    // 金貨の部屋の下のピンを先に抜いておき、上のピンを抜いて金貨を男の子まで落とす。
    // 上の金貨の部屋までは入らないので、落ちていく金貨とマグマの部屋の底と男の子を撮る
    id: 'pin-rescue',
    level: 10,
    clip: band(530),
    play: async (s) => {
      await s.startSolo();
      await s.tap(1, 66, 553);
      await s.wait(1200);
      await s.tap(1, 66, 341);
      await s.wait(800);
    }
  },
  {
    // 最後から 2 つ目の門（×2 と +10）の手前。そこまでの門は増えるほうをくぐる
    id: 'gate-run',
    level: 6,
    clip: band(280),
    play: async (s) => {
      await s.startSolo();
      await s.touch(1, 'down', 384, 900);
      await s.touch(1, 'move', 530, 900);
      await s.wait(8000);
      await s.touch(1, 'move', 325, 900);
      await s.wait(11700);
    }
  },
  {
    // 犬を半円の線で囲み、巣から来たハチが線に当たりはじめたところ
    id: 'dog-guard',
    level: 1,
    clip: band(560),
    play: async (s) => {
      await s.startSolo();
      // 盤面の座標（幅 1・高さ 1.4）を画面に直す。犬は x 0.549 の地面に立つ
      const at = (x: number, y: number): Point => [50.5 + x * 667, 90 + y * 667];
      const dome = Array.from({ length: 21 }, (_, i) => {
        const a = (i / 20) * Math.PI;
        return at(0.549 - Math.cos(a) * 0.18, 1.315 - Math.sin(a) * 0.18);
      });
      await stroke(s, dome, 700);
      await s.wait(3600);
    }
  },
  {
    // カメラは主人公を追うので、クマの前で斧を振っているときに下のキャンプが画面に残る位置で撮る
    id: 'snow-camp',
    level: 1,
    clip: band(476),
    play: async (s) => {
      await s.startSolo();
      await s.touch(1, 'down', 384, 800);
      await s.touch(1, 'move', 406, 743);
      await s.wait(850);
      // 指を離しても、近くの動物には自動で斧を振る。スティックの丸を消して撮る
      await s.touch(1, 'up', 406, 743);
      await s.wait(300);
    }
  },
  {
    // 吹き出しまでは 680 : 400 に収まらないので、目から下とゴミ箱を入れる。
    // 道具の先端は指より少し上（TIP）に出るので、指は狙う場所の 41px 下に置く
    id: 'dentist',
    level: 4,
    clip: band(408),
    play: async (s) => {
      await s.startSolo();
      // 下の列の真ん中の虫歯を削りきると、バイキンが 2 匹出てくる
      await s.press('button[aria-label="ドリル"]');
      await s.touch(1, 'down', 384, 663);
      await s.wait(1200);
      await s.touch(1, 'up', 384, 663);
      await s.wait(800);
      await s.press('button[aria-label="ピンセット"]');
      await s.drag(
        1,
        [
          [372, 663],
          [540, 790]
        ],
        600
      );
      await s.wait(100);
    }
  },
  {
    // ムシは頭の側へ歩くので、2 匹とも画面の内側を向くように描く。最後のまるには線を足さない
    id: 'doodle-worm',
    clip: band(290),
    play: async (s) => {
      await s.startSolo();
      await stroke(s, circle(260, 400, 55), 400);
      await stroke(s, wave(200, 410, -170), 400);
      await s.press('button[aria-label="みずいろ"]');
      await stroke(s, circle(500, 620, 50), 400);
      await stroke(s, wave(550, 630, 180), 400);
      await s.press('button[aria-label="ピンク"]');
      await stroke(s, circle(560, 400, 45), 400);
      // ムシはときどき目を閉じるので、目が開いているコマで止める
      await s.wait(350);
    }
  },
  { id: 'border-rush', clip: band(250), play: borderRush },
  { id: 'bomb-relay', clip: band(300), play: bombRelay },
  {
    // 相手のゴールまでは入らないので、境界線をはさんで両者のマレットとパックを撮る
    id: 'hockey',
    clip: band(300),
    play: async (s) => {
      await s.startDuel();
      await s.touch(2, 'down', 250, 380);
      await s.touch(1, 'down', 384, 960);
      await s.wait(300);
      await s.touch(2, 'move', 260, 390);
      for (let y = 900; y >= 640; y -= 60) {
        await s.touch(1, 'move', 384, y);
        await s.wait(16);
      }
      await s.touch(1, 'move', 384, 620);
      await s.wait(16);
    }
  },
  { id: 'bug-rush', clip: band(286), play: bugRush },
  // 両側の指示までは入らないので、手前の指示と真ん中の稲妻、向かいの陣地の端を撮る
  { id: 'lightning', clip: band(445), play: lightning }
];
