import { ANIMAL_ART } from './art/animals';
import { BOSS_ART } from './art/bosses';
import { ENEMY_ART } from './art/enemies';
import { FOREST_ART } from './art/forest';
import { GRAVE_ART } from './art/graveyard';
import { goldArt } from './art/evolved';
import { GEAR_ART } from './art/gear';
import { ITEM_ART } from './art/items';
import { SNOW_ART } from './art/snow';
import { VOLCANO_ART } from './art/volcano';
import { PALETTE } from './art/palette';
import { shots, swipes, zonesBelow } from './draw-arms';
import { bossBars, hazardsAbove, hazardsBelow, introDust, introEdge } from './draw-boss';
import { growFrame } from './grow';
import { byFeet, covers, drawObstacles, inView } from './draw-obstacles';
import { hash, obstaclesNear, type Obstacle } from './obstacles';
import type { Prompts } from './prompts.svelte';
import { nearestHero, RAISE_SECS, type Hero } from './heroes';
import { chiefArrows, confetti, partnerArrows, treasureArrow } from './draw-events';
import { blizzard } from './draw-storm';
import { drawLava } from './draw-volcano';
import { EAGLE } from './bosses-forest';
import { PHOENIX } from './bosses-volcano';
import { airborne, YETI } from './bosses-snow';
import { gemTier } from './drops';
import type { Effects } from './effects';
import { hud } from './hud';
import { bake, type Art } from './pixels';
import type { Enemy, World } from './world';

export interface ViewSize {
  /** 仮想画面の 1 ドットが何画素か */
  scale: number;
  w: number;
  h: number;
}

/** 幅が 260 ドット前後になる整数の倍率。cssW と cssH は盤面そのものの大きさ（横向きで回しても縦長のまま） */
export function viewSize(cssW: number, cssH: number, dpr: number): ViewSize {
  const scale = Math.max(2, Math.round((cssW * dpr) / 260));
  return { scale, w: Math.ceil((cssW * dpr) / scale), h: Math.ceil((cssH * dpr) / scale) };
}

/** 盤面そのものの大きさ（CSS の px）から仮想画面を決め、canvas を端末の画素の大きさに合わせる */
export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): ViewSize {
  const dpr = devicePixelRatio || 1;
  const view = viewSize(cssW, cssH, dpr);
  canvas.width = view.w * view.scale;
  canvas.height = view.h * view.scale;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  return view;
}

/** v の整数部を n で割った余り。座標から作るコマ番号は負になりうるので、0..n-1 に入れる */
export function frameAt(v: number, n: number): number {
  return ((Math.floor(v) % n) + n) % n;
}

/** 仮想画面のドット v を、端末の画素の位置に丸める。カメラと絵をこの細かさで動かすと、絵の 1 ドットの幅は変わらずになめらかに動く */
export function devicePx(v: number, scale: number): number {
  return Math.round(v * scale);
}

/** いま描いている倍率。draw() の頭で決め、下の部品が位置を丸めるのに使う */
let S = 1;
const q = (v: number) => devicePx(v, S) / S;

export { hash };

const seen: Obstacle[] = [];
const hide: Obstacle[] = [];

function sprite(
  ctx: CanvasRenderingContext2D,
  art: Art,
  frame: number,
  x: number,
  y: number,
  flip = false,
  white = false,
  gold = false,
  // 強化個体は 2 倍、ヌシは 3 倍で描く（整数倍ならドットの粒がそろう）
  k = gold ? 2 : 1
) {
  const mode = white ? (flip ? 'flipWhite' : 'white') : gold ? (flip ? 'flipGold' : 'gold') : flip ? 'flip' : 'normal';
  ctx.drawImage(bake(art, frame, mode), q(x - (art.w * k) / 2), q(y - (art.h * k) / 2), art.w * k, art.h * k);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const x0 = q(x - w / 2);
  const y0 = q(y);
  ctx.fillRect(x0 + 1, y0 - 1, w - 2, 1);
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, 1);
}

/** 面ごとの地面と飾り。飾りは場所のハッシュがこの値より小さい最初の種類（null は何も置かない） */
const GROUNDS = {
  forest: {
    art: FOREST_ART,
    decor: [
      [0.55, null],
      [0.73, 'tuft'],
      [0.85, 'flower'],
      [0.91, 'rock'],
      [0.95, 'stump'],
      [1, 'tree']
    ],
    shadowed: ['tree', 'rock', 'stump']
  },
  graveyard: {
    art: GRAVE_ART,
    decor: [
      [0.55, null],
      [0.72, 'bones'],
      [0.84, 'candle'],
      [0.92, 'cross'],
      [0.97, 'tomb'],
      [1, 'deadtree']
    ],
    shadowed: ['tomb', 'cross', 'deadtree']
  },
  snow: {
    art: SNOW_ART,
    decor: [
      [0.58, null],
      [0.72, 'drift'],
      [0.82, 'tuft'],
      [0.9, 'ice'],
      [0.95, 'rock'],
      [1, 'pine']
    ],
    shadowed: ['pine', 'rock']
  },
  volcano: {
    art: VOLCANO_ART,
    decor: [
      [0.66, null],
      [0.7, 'crack'],
      [0.84, 'basalt'],
      [0.91, 'ember'],
      [0.96, 'smoke'],
      [1, 'spire']
    ],
    shadowed: ['spire', 'basalt', 'smoke']
  }
} as const;

function ground(ctx: CanvasRenderingContext2D, w: World, cx: number, cy: number, v: ViewSize) {
  const g = GROUNDS[w.stage.art];
  const decor: Record<string, Art> = g.art.decor;
  const T = 16;
  for (let ty = Math.floor(cy / T); ty * T < cy + v.h; ty++)
    for (let tx = Math.floor(cx / T); tx * T < cx + v.w; tx++) {
      const h = hash(tx, ty);
      if (h < 0.08) ctx.drawImage(bake(g.art.dirt), tx * T, ty * T);
      else ctx.drawImage(bake(g.art.grass, Math.floor(hash(tx + 911, ty) * 4)), tx * T, ty * T);
    }
  const C = 48;
  ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
  for (let gy = Math.floor(cy / C) - 1; gy * C < cy + v.h + 40; gy++)
    for (let gx = Math.floor(cx / C) - 1; gx * C < cx + v.w + 16; gx++) {
      const h = hash(gx * 7 + 3, gy * 5 + 1);
      const kind = g.decor.find(([p]) => h < p)![1];
      if (!kind) continue;
      const x = gx * C + 8 + Math.floor(hash(gx, gy * 3) * 32);
      const y = gy * C + 16 + Math.floor(hash(gx * 3, gy) * 28);
      if (obstaclesNear(w.stage.art, x, y, 8, seen).length) continue;
      const art = decor[kind];
      if ((g.shadowed as readonly string[]).includes(kind)) shadow(ctx, x, y - 1, Math.round(art.w * 0.8));
      ctx.drawImage(bake(art), Math.round(x - art.w / 2), y - art.h);
    }
}

/** 育つ演出のはじける光。自分から広がる白い輪と光の筋（k は 1 から 0 へ減る強さ） */
function growBurst(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, k: number) {
  const spread = 1 - k;
  ctx.globalAlpha = k;
  ctx.strokeStyle = PALETTE.w;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8 + spread * 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.y;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 10 + spread * 70;
    ctx.fillRect(q(p.x + Math.cos(a) * r) - 1, q(p.y + Math.sin(a) * r) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/** 当たったあとの無敵のあいだの濃さ。点滅させると大群に囲まれたときずっとチカチカするので、消さずに薄く描く */
export const HURT_ALPHA = 0.55;
/** 育つ演出のあいだは無敵の時計が止まるので薄くしない */
export const hurtAlpha = (invuln: number, moment: boolean) => (!moment && invuln > 0 ? HURT_ALPHA : 1);
/** ふたりで遊ぶときに倒れた動物の濃さ */
export const DOWN_ALPHA = 0.5;
export const heroAlpha = (invuln: number, moment: boolean, down: boolean) =>
  (down ? DOWN_ALPHA : 1) * hurtAlpha(invuln, moment);

/** 攻撃を受けた敵に重ねる白の濃さ。真っ白に切り替えると、大群が一斉に点滅して見える */
const HIT_WHITE = 0.5;

/** 時計の青い膜の濃さ。最後の 2 秒はなめらかに明滅させて終わりを知らせる（2 秒の境でも飛ばない） */
export const freezeAlpha = (left: number) => (left > 2 ? 0.22 : 0.15 + 0.07 * Math.cos((2 - left) * Math.PI * 2 * 1.5));

/** form と white は育つ演出のときだけ渡す（入れ替わる姿と白い影） */
function player(ctx: CanvasRenderingContext2D, w: World, now: number, form = w.form, white = false, moment = false) {
  const p = w.player;
  const a = ANIMAL_ART[w.animal.id].forms[form];
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  shadow(ctx, p.x, p.y + 7, 12 + form * 3);
  if (white) {
    sprite(ctx, a.walk, 0, p.x, p.y - (a.walk.h - 16) / 2, p.facing < 0, true);
    return;
  }
  const [art, frame] =
    p.hurt > 0 ? [a.hurt, 0] : p.attack > 0 ? [a.attack, 0] : p.moving ? [a.walk, frameAt(now * 10, 4)] : [a.walk, 0];
  const flip = p.facing < 0;
  // 育って大きくなっても足もとは 1 段階めと同じ高さにそろえる
  const y = p.y - (art.h - 16) / 2;
  ctx.globalAlpha = heroAlpha(p.invuln, moment, w.heroes[w.cur].down);
  // 白いふちで、大群の中でも自分を見失わないようにする
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ])
    sprite(ctx, art, frame, p.x + dx, y + dy, flip, true);
  sprite(ctx, art, frame, p.x, y, flip);
  ctx.globalAlpha = 1;
  if (p.hp < w.stats.maxHp) {
    const x = q(p.x - 8);
    const y = q(p.y + 10);
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(x - 1, y - 1, 18, 4);
    ctx.fillStyle = PALETTE.R;
    ctx.fillRect(x, y, 16, 2);
    ctx.fillStyle = PALETTE.r;
    ctx.fillRect(x, y, Math.round((16 * p.hp) / w.stats.maxHp), 2);
  }
}

/** ふつうの敵とボスの絵を id で引く */
const ART: Record<string, Art> = { ...ENEMY_ART, ...BOSS_ART };

const order: Enemy[] = [];
const sizeOf = (e: Enemy) => (e.def.chief ? 3 : e.def.elite ? 2 : 1);

/** 絵のいちばん上の行の、塗った範囲のまん中（王冠を頭に載せる位置） */
const heads = new Map<Art, { top: number; x: number }>();
function headOf(art: Art) {
  let h = heads.get(art);
  if (!h) {
    const rows = art.frames[0];
    const top = Math.max(
      0,
      rows.findIndex((r) => /[^.]/.test(r))
    );
    const xs = [...rows[top]].flatMap((c, i) => (c === '.' ? [] : [i]));
    h = { top, x: (xs[0] + xs[xs.length - 1] + 1) / 2 };
    heads.set(art, h);
  }
  return h;
}

function crown(ctx: CanvasRenderingContext2D, e: Enemy, art: Art, flip: boolean) {
  const c = ITEM_ART.crown;
  const h = headOf(art);
  const x = e.x + (h.x - art.w / 2) * 3 * (flip ? -1 : 1);
  const y = e.y - (art.h * 3) / 2 + (h.top - 5) * 3;
  ctx.drawImage(bake(c), q(x - (c.w * 3) / 2), q(y), c.w * 3, c.h * 3);
}

/** 宙にいる大雪男と、空にいる大ワシ・不死鳥が、飛び立ってからの割合 0..1 */
const soaring = (e: Enemy) => e.def.ai === 'eagle' || e.def.ai === 'phoenix';
const flight = (e: Enemy) =>
  1 - Math.max(0, e.wait) / (e.def.ai === 'phoenix' ? PHOENIX.warn : soaring(e) ? EAGLE.warn : YETI.pounceWarn);

/** 宙にいるボスの真下の地面。飛び立った所から落ちる先へ進む（影と画面に入るかはここで見る） */
function footing(e: Enemy) {
  // よみがえっている不死鳥はその場で光っているだけ
  if (!airborne(e) || e.state === 5) return e;
  const t = flight(e);
  return { x: e.x + (e.dx - e.x) * t, y: e.y + (e.dy - e.y) * t };
}

/** 宙にいるボスは、真下の地面から弧を描いて浮く。大ワシは高く舞い上がってから急降下する */
function leap(e: Enemy) {
  const g = footing(e);
  if (e.state === 5) return g;
  return { x: g.x, y: g.y - Math.sin(Math.PI * flight(e)) * (soaring(e) ? 120 : 48) };
}

/** きらきらハリネズミのまわりで、光の点が順にまたたく */
function sparkle(ctx: CanvasRenderingContext2D, e: Enemy, now: number) {
  for (let i = 0; i < 3; i++) {
    const t = (now * 1.5 + i / 3) % 1;
    const a = i * 2.1 + Math.floor(now * 1.5 + i / 3) * 1.3;
    const x = q(e.x + Math.cos(a) * 11);
    const y = q(e.y + Math.sin(a) * 9);
    const s = t < 0.5 ? 1 : 0;
    ctx.fillStyle = PALETTE.y;
    ctx.fillRect(x - 1 - s, y, 3 + 2 * s, 1);
    ctx.fillRect(x, y - 1 - s, 1, 3 + 2 * s);
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(x, y, 1, 1);
  }
}

/** 歩く絵の時計。登場の札に映っているボスだけは、ゲームの時計が止まっているあいだも lively（登場の時間）で動かす */
export const walkClock = (e: Enemy, introduced: boolean, lively: number) =>
  e.def.boss && introduced ? e.t + lively : e.t;

function enemies(
  ctx: CanvasRenderingContext2D,
  w: World,
  cx: number,
  cy: number,
  v: ViewSize,
  now: number,
  obstacles: Obstacle[],
  lively = 0,
  introduced: number[] = []
) {
  order.length = 0;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const g = footing(e);
    if (g.x > cx - 48 && g.x < cx + v.w + 48 && g.y > cy - 48 && g.y < cy + v.h + 48) order.push(e);
  }
  const feet = (e: Enemy) => footing(e).y + (ART[e.def.id].h * sizeOf(e)) / 2;
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  for (const e of order) shadow(ctx, footing(e).x, feet(e) - 1, Math.round(e.def.r * (e.def.boss ? 2.2 : 1.8)));
  for (const e of byFeet(order, feet, obstacles)) {
    if (!('def' in e)) {
      drawObstacles(ctx, [e], now, q);
      continue;
    }
    const art = ART[e.def.id];
    // 巨大ベアと溶岩の巨人は地ならしの予告のあいだ、宙にいるボスは上げたコマにする（よみがえっている不死鳥は羽ばたく）
    const up = ((e.def.ai === 'bear' || e.def.ai === 'giant') && e.state === 3) || (airborne(e) && e.state !== 5);
    const clock = walkClock(e, e.def.boss ? introduced.includes(w.enemies.indexOf(e)) : false, lively);
    const frame = up ? 2 : frameAt(clock * (e.def.boss ? 4 : 6), 2);
    // 敵は追っている動物のほうを向く。逃げるきらきらハリネズミだけは反対を向く
    const flip = !e.def.prop && w.heroes[nearestHero(w, e.x, e.y)].player.x < e.x !== Boolean(e.def.metal);
    const at = airborne(e) ? leap(e) : e;
    sprite(ctx, art, frame, at.x, at.y, flip, false, e.def.elite, sizeOf(e));
    if (e.flash > 0) {
      ctx.globalAlpha = HIT_WHITE;
      sprite(ctx, art, frame, at.x, at.y, flip, true, e.def.elite, sizeOf(e));
      ctx.globalAlpha = 1;
    }
    if (e.def.chief) crown(ctx, e, art, flip);
    if (e.def.metal) sparkle(ctx, e, now);
  }
}

function pickups(ctx: CanvasRenderingContext2D, w: World, now: number) {
  for (const g of w.gems) {
    if (!g.alive) continue;
    sprite(ctx, ITEM_ART[`gem${gemTier(g.value)}`], frameAt(now * 3 + g.x * 0.1, 2), g.x, g.y);
  }
  for (const it of w.items)
    if (it.alive)
      sprite(
        ctx,
        it.kind === 'ticket'
          ? GEAR_ART[`ticket${it.tier ?? 0}`]
          : it.kind === 'goldMagnet'
            ? goldArt(ITEM_ART.magnet)
            : ITEM_ART[it.kind],
        it.kind === 'coin' ? frameAt(now * 6, 2) : 0,
        it.x,
        it.y + Math.sin(now * 4) * 1.5
      );
}

/** 端末の画素の canvas に、仮想画面の scale 倍で描く */
/** 倒れた動物を起こしている残り。動物のまわりに、満ちていく輪を描く */
function raising(ctx: CanvasRenderingContext2D, h: Hero): void {
  if (!h.down || h.revive <= 0) return;
  const p = h.player;
  ctx.strokeStyle = PALETTE.y;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * h.revive) / RAISE_SECS);
  ctx.stroke();
}

/** 描く動物の順。自分（cur）がほかの動物の下に隠れないよう、自分を最後にする */
export function heroOrder(w: World): number[] {
  return [...w.heroes.keys()].filter((i) => i !== w.cur && !w.heroes[i].gone).concat(w.cur);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  w: World,
  fx: Effects,
  v: ViewSize,
  now: number,
  top: number,
  prompts?: Prompts
): void {
  S = v.scale;
  ctx.imageSmoothingEnabled = false;
  const p = w.player;
  // ボスの登場のあいだはカメラを寄る先へ動かす
  const eye = prompts?.focus(w) ?? p;
  const cx = eye.x - v.w / 2;
  const cy = eye.y - v.h / 2;
  ctx.setTransform(S, 0, 0, S, -devicePx(cx, S), -devicePx(cy, S));
  ground(ctx, w, cx, cy, v);
  drawLava(ctx, w, now);
  hazardsBelow(ctx, w, q, now);
  zonesBelow(ctx, w, q, now);
  pickups(ctx, w, now);
  inView(w.stage.art, cx, cy, v.w, v.h, seen);
  enemies(ctx, w, cx, cy, v, now, seen, prompts?.intro?.t ?? 0, prompts?.intro?.ids);
  const ev = prompts?.growing ? prompts.evolve : null;
  const grow = ev ? growFrame(ev.t, prompts!.still) : null;
  if (!grow) {
    const me = w.cur;
    for (const i of heroOrder(w)) {
      w.cur = i;
      player(ctx, w, now);
      raising(ctx, w.heroes[i]);
      // 育っても足もとは同じ高さで、絵は上へ伸びる
      const h = 16 + w.form * 4;
      const at = w.player;
      hide.length = 0;
      for (const o of seen) if (covers(o, at.x, at.y + 8 - h / 2, h)) hide.push(o);
      drawObstacles(ctx, hide, now, q, i === me ? at : undefined, false);
    }
    w.cur = me;
  }
  shots(ctx, w, q);
  swipes(ctx, w, q);
  hazardsAbove(ctx, w, q);
  if (prompts?.intro) introDust(ctx, w, prompts.intro);
  fx.draw(ctx, S);
  if (ev && grow) {
    // 育つ演出のあいだは、弾や予告も含めてまわりを暗くし、自分だけを照らす
    if (grow.dark) {
      ctx.fillStyle = `rgb(12 6 24 / ${grow.dark})`;
      ctx.fillRect(cx, cy, v.w, v.h);
    }
    player(ctx, w, now, grow.form === 'old' ? ev.fromForm : ev.form, grow.white, true);
    if (grow.burst) growBurst(ctx, p, grow.burst);
  }
  ctx.setTransform(S, 0, 0, S, 0, 0);
  // 磁石は青、被弾は赤で画面の縁を光らせる（画面を揺らすと酔うので揺らさない）
  for (const [t, max, color] of [
    [fx.edge, 0.3, PALETTE.u],
    [fx.hurt, 0.25, PALETTE.r]
  ] as const) {
    if (t <= 0) continue;
    ctx.globalAlpha = (t / max) * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, v.w - 4, v.h - 4);
  }
  if (w.freeze > 0) {
    ctx.globalAlpha = freezeAlpha(w.freeze);
    ctx.fillStyle = PALETTE.u;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(1, fx.flash / 0.25) * 0.5;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  ctx.globalAlpha = 1;
  if (prompts?.intro) introEdge(ctx, v, prompts.intro);
  if (grow?.burst) {
    ctx.globalAlpha = grow.burst * 0.45;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.globalAlpha = 1;
  }
  blizzard(ctx, w, v.w, v.h, now);
  confetti(ctx, w, v.w, v.h, now);
  hud(ctx, w, v, top);
  // ボスの登場のあいだはカメラが自分から離れるので、自分から測る矢印の向きが合わない
  if (!prompts?.intro) {
    treasureArrow(ctx, w, v.w, v.h, top, now);
    chiefArrows(ctx, w, v.w, v.h, top);
    partnerArrows(ctx, w, v.w, v.h, top);
  }
  bossBars(ctx, w, v, top);
}
