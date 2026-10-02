import { ANIMAL_ART } from './art/animals';
import { BOSS_ART } from './art/bosses';
import { ENEMY_ART } from './art/enemies';
import { FOREST_ART } from './art/forest';
import { GRAVE_ART } from './art/graveyard';
import { goldArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { shots, swipes, zonesBelow } from './draw-arms';
import { bossBars, hazardsAbove, hazardsBelow } from './draw-boss';
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

/** 座標から決まる 0..1。地面と飾りを毎フレーム同じに並べる */
export function hash(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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
      const art = decor[kind];
      const x = gx * C + 8 + Math.floor(hash(gx, gy * 3) * 32);
      const y = gy * C + 16 + Math.floor(hash(gx * 3, gy) * 28);
      if ((g.shadowed as readonly string[]).includes(kind)) shadow(ctx, x, y - 1, Math.round(art.w * 0.8));
      ctx.drawImage(bake(art), Math.round(x - art.w / 2), y - art.h);
    }
}

function player(ctx: CanvasRenderingContext2D, w: World, now: number) {
  const p = w.player;
  const a = ANIMAL_ART[w.animal.id].forms[w.form];
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  shadow(ctx, p.x, p.y + 7, 12 + w.form * 3);
  if (p.invuln > 0 && Math.floor(p.invuln / 0.08) % 2 === 1) return;
  const [art, frame] =
    p.hurt > 0 ? [a.hurt, 0] : p.attack > 0 ? [a.attack, 0] : p.moving ? [a.walk, frameAt(now * 10, 4)] : [a.walk, 0];
  const flip = p.facing < 0;
  // 育って大きくなっても足もとは 1 段階めと同じ高さにそろえる
  const y = p.y - (art.h - 16) / 2;
  // 白いふちで、大群の中でも自分を見失わないようにする
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ])
    sprite(ctx, art, frame, p.x + dx, y + dy, flip, true);
  sprite(ctx, art, frame, p.x, y, flip);
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

function enemies(ctx: CanvasRenderingContext2D, w: World, cx: number, cy: number, v: ViewSize, now: number) {
  order.length = 0;
  for (const e of w.enemies)
    if (e.alive && e.x > cx - 48 && e.x < cx + v.w + 48 && e.y > cy - 48 && e.y < cy + v.h + 48) order.push(e);
  order.sort((a, b) => a.y - b.y);
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  for (const e of order)
    shadow(ctx, e.x, e.y + (ART[e.def.id].h * sizeOf(e)) / 2 - 1, Math.round(e.def.r * (e.def.boss ? 2.2 : 1.8)));
  for (const e of order) {
    const art = ART[e.def.id];
    // 巨大ベアは地ならしの予告のあいだ、両手を上げたコマにする
    const frame = e.def.ai === 'bear' && e.state === 3 ? 2 : frameAt(e.t * (e.def.boss ? 4 : 6), 2);
    // 敵は自分のほうを向く。逃げるきらきらハリネズミだけは反対を向く
    const flip = !e.def.prop && w.player.x < e.x !== Boolean(e.def.metal);
    sprite(ctx, art, frame, e.x, e.y, flip, e.flash > 0, e.def.elite, sizeOf(e));
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
        it.kind === 'goldMagnet' ? goldArt(ITEM_ART.magnet) : ITEM_ART[it.kind],
        it.kind === 'coin' ? frameAt(now * 6, 2) : 0,
        it.x,
        it.y + Math.sin(now * 4) * 1.5
      );
}

/** 端末の画素の canvas に、仮想画面の scale 倍で描く */
export function draw(
  ctx: CanvasRenderingContext2D,
  w: World,
  fx: Effects,
  v: ViewSize,
  now: number,
  top: number
): void {
  S = v.scale;
  ctx.imageSmoothingEnabled = false;
  const p = w.player;
  const cx = p.x - v.w / 2;
  const cy = p.y - v.h / 2;
  ctx.setTransform(S, 0, 0, S, -devicePx(cx, S), -devicePx(cy, S));
  ground(ctx, w, cx, cy, v);
  hazardsBelow(ctx, w, q, now);
  zonesBelow(ctx, w, q, now);
  pickups(ctx, w, now);
  enemies(ctx, w, cx, cy, v, now);
  player(ctx, w, now);
  shots(ctx, w, q);
  swipes(ctx, w, q);
  hazardsAbove(ctx, w, q);
  fx.draw(ctx, S);
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
    // 時計で止まっているあいだは画面をうっすら青くし、最後の 2 秒は点滅させて終わりを知らせる
    ctx.globalAlpha = w.freeze > 2 || Math.floor(now * 6) % 2 ? 0.22 : 0.08;
    ctx.fillStyle = PALETTE.u;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(1, fx.flash / 0.25) * 0.7;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(0, 0, v.w, v.h);
  }
  ctx.globalAlpha = 1;
  hud(ctx, w, v, top);
  bossBars(ctx, w, v, top);
}
