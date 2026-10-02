import { ANIMAL_ART } from './art/animals';
import { BOSS_ART } from './art/bosses';
import { ENEMY_ART } from './art/enemies';
import { FOREST_ART } from './art/forest';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
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
function hash(x: number, y: number) {
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
  white = false
) {
  ctx.drawImage(
    bake(art, frame, flip ? (white ? 'flipWhite' : 'flip') : white ? 'white' : 'normal'),
    q(x - art.w / 2),
    q(y - art.h / 2)
  );
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const x0 = q(x - w / 2);
  const y0 = q(y);
  ctx.fillRect(x0 + 1, y0 - 1, w - 2, 1);
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, 1);
}

const DECOR: [number, keyof typeof FOREST_ART.decor | null][] = [
  [0.55, null],
  [0.73, 'tuft'],
  [0.85, 'flower'],
  [0.91, 'rock'],
  [0.95, 'stump'],
  [1, 'tree']
];

function ground(ctx: CanvasRenderingContext2D, cx: number, cy: number, v: ViewSize) {
  const T = 16;
  for (let ty = Math.floor(cy / T); ty * T < cy + v.h; ty++)
    for (let tx = Math.floor(cx / T); tx * T < cx + v.w; tx++) {
      const h = hash(tx, ty);
      if (h < 0.08) ctx.drawImage(bake(FOREST_ART.dirt), tx * T, ty * T);
      else ctx.drawImage(bake(FOREST_ART.grass, Math.floor(hash(tx + 911, ty) * 4)), tx * T, ty * T);
    }
  const C = 48;
  ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
  for (let gy = Math.floor(cy / C) - 1; gy * C < cy + v.h + 40; gy++)
    for (let gx = Math.floor(cx / C) - 1; gx * C < cx + v.w + 16; gx++) {
      const h = hash(gx * 7 + 3, gy * 5 + 1);
      const kind = DECOR.find(([p]) => h < p)![1];
      if (!kind) continue;
      const art = FOREST_ART.decor[kind];
      const x = gx * C + 8 + Math.floor(hash(gx, gy * 3) * 32);
      const y = gy * C + 16 + Math.floor(hash(gx * 3, gy) * 28);
      if (kind === 'tree' || kind === 'rock' || kind === 'stump') shadow(ctx, x, y - 1, Math.round(art.w * 0.8));
      ctx.drawImage(bake(art), Math.round(x - art.w / 2), y - art.h);
    }
}

function player(ctx: CanvasRenderingContext2D, w: World, now: number) {
  const p = w.player;
  const a = ANIMAL_ART[w.animal.id];
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  shadow(ctx, p.x, p.y + 7, 12);
  if (p.invuln > 0 && Math.floor(p.invuln / 0.08) % 2 === 1) return;
  const [art, frame] =
    p.hurt > 0 ? [a.hurt, 0] : p.attack > 0 ? [a.attack, 0] : p.moving ? [a.walk, frameAt(now * 10, 4)] : [a.walk, 0];
  const flip = p.facing < 0;
  // 白いふちで、大群の中でも自分を見失わないようにする
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ])
    sprite(ctx, art, frame, p.x + dx, p.y + dy, flip, true);
  sprite(ctx, art, frame, p.x, p.y, flip);
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

function enemies(ctx: CanvasRenderingContext2D, w: World, cx: number, cy: number, v: ViewSize) {
  order.length = 0;
  for (const e of w.enemies)
    if (e.alive && e.x > cx - 24 && e.x < cx + v.w + 24 && e.y > cy - 24 && e.y < cy + v.h + 24) order.push(e);
  order.sort((a, b) => a.y - b.y);
  ctx.fillStyle = 'rgb(0 0 0 / 0.25)';
  for (const e of order) shadow(ctx, e.x, e.y + ART[e.def.id].h / 2 - 1, Math.round(e.def.r * 1.8));
  for (const e of order) {
    const art = ART[e.def.id];
    sprite(ctx, art, frameAt(e.t * 6, 2), e.x, e.y, w.player.x < e.x, e.flash > 0);
  }
}

function pickups(ctx: CanvasRenderingContext2D, w: World, now: number) {
  for (const g of w.gems) {
    if (!g.alive) continue;
    sprite(ctx, ITEM_ART[`gem${gemTier(g.value)}`], frameAt(now * 3 + g.x * 0.1, 2), g.x, g.y);
  }
  for (const it of w.items) if (it.alive) sprite(ctx, ITEM_ART[it.kind], 0, it.x, it.y + Math.sin(now * 4) * 1.5);
}

function rotated(ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, angle: number, size = 1) {
  ctx.save();
  ctx.translate(q(x), q(y));
  ctx.rotate(angle);
  ctx.drawImage(bake(art), (-art.w * size) / 2, (-art.h * size) / 2, art.w * size, art.h * size);
  ctx.restore();
}

function shots(ctx: CanvasRenderingContext2D, w: World) {
  for (const o of w.shots) {
    if (!o.alive) continue;
    if (o.kind === 'shot') rotated(ctx, ITEM_ART.bone, o.x, o.y, o.age * 14);
    else if (o.kind === 'boomerang') rotated(ctx, ITEM_ART.bone, o.x, o.y, o.age * 16, 1.6);
    else if (o.kind === 'homing') rotated(ctx, ITEM_ART.fish, o.x, o.y, o.angle);
    else rotated(ctx, ITEM_ART.feather, o.x, o.y, o.angle + Math.PI / 2);
  }
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 90);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + (i === 6 ? 0 : (hash(seed, i) - 0.5) * 14), y - 90 + i * 15);
  ctx.stroke();
}

function effects(ctx: CanvasRenderingContext2D, w: World) {
  ctx.lineCap = 'square';
  for (const f of w.effects) {
    if (!f.alive) continue;
    const t = f.age / f.life;
    if (f.kind === 'swipe') {
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.strokeStyle = PALETTE.w;
      for (const [r, lw] of [
        [0.85, 3],
        [0.6, 2]
      ]) {
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * r, f.angle - 0.95 + t * 0.4, f.angle + 0.95 + t * 0.4);
        ctx.stroke();
      }
    } else if (f.kind === 'ring') {
      const r = t * f.r;
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.w;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.u;
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(0, r - 3), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'bolt') {
      ctx.globalAlpha = 0.75 * (1 - t * t);
      ctx.strokeStyle = PALETTE.y;
      ctx.lineWidth = 3;
      bolt(ctx, f.x, f.y, Math.floor(f.born * 60));
      ctx.strokeStyle = PALETTE.w;
      ctx.lineWidth = 1;
      bolt(ctx, f.x, f.y, Math.floor(f.born * 60));
      ctx.fillStyle = PALETTE.y;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.fillStyle = PALETTE.o;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.6 + t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
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
  ground(ctx, cx, cy, v);
  pickups(ctx, w, now);
  enemies(ctx, w, cx, cy, v);
  player(ctx, w, now);
  shots(ctx, w);
  effects(ctx, w);
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
  ctx.globalAlpha = 1;
  hud(ctx, w, v, top);
}
