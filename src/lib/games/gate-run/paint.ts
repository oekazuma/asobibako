import { cloud, icon, label, stamp } from '$lib/fx';
import {
  BARREL_R,
  crowdCenter,
  crowdHalf,
  enemyCount,
  isGood,
  MAX_DOTS,
  type GameState,
  type Item,
  type Op
} from './engine';
import { barrel, castle, runner, tree } from './sprites';

const CLOUDS = [
  [0.1, 0.3, 0.22],
  [0.55, 0.18, 0.3],
  [0.9, 0.45, 0.18]
] as const;

/**
 * 群れの後ろ上から見下ろす遠近。奥行き z の点は 1/z 倍に縮み、z が大きいほど地平線へ寄る。
 * 群れは z = CROWD_Z に置き、コースの距離 1 を奥行き DEPTH に対応させる
 */
const HORIZON = 0.3;
const CROWD_Z = 1;
const DEPTH = 1.25;
const FAR = 9;
const GOLDEN = 2.39996;

const BLUE = ['#4db5ff', '#0b6fcc'] as const;
const RED = ['#ff7a86', '#c42a3b'] as const;

export interface View {
  w: number;
  h: number;
}

/** 道の横位置 lane（0..1）と奥行き z を画面の位置と倍率へ */
export function project(v: View, lane: number, z: number): [number, number, number] {
  const s = 1 / z;
  return [v.w / 2 + (lane - 0.5) * v.w * 0.92 * s, v.h * HORIZON + v.h * 0.5 * s, s];
}

export const zOf = (state: GameState, at: number) => (at - state.dist) * DEPTH + CROWD_Z;
export const opText = (op: Op) => (op.kind === 'mul' ? `×${op.n}` : op.n < 0 ? `-${-op.n}` : `+${op.n}`);

function ground(ctx: CanvasRenderingContext2D, v: View, state: GameState, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.h * HORIZON);
  sky.addColorStop(0, '#6ec8ff');
  sky.addColorStop(1, '#d9f2ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, v.w, v.h * HORIZON + 1);
  for (const [cx, cy, r] of CLOUDS) {
    const x = ((cx + now * 0.01) % 1.3) - 0.15;
    stamp(ctx, cloud(), x * v.w, cy * v.h * HORIZON, r * v.w);
  }
  const grass = ctx.createLinearGradient(0, v.h * HORIZON, 0, v.h);
  grass.addColorStop(0, '#9fdc7c');
  grass.addColorStop(1, '#58b947');
  ctx.fillStyle = grass;
  ctx.fillRect(0, v.h * HORIZON, v.w, v.h);

  // 道は奥行きの帯ごとに台形で塗り、進んだ距離に合わせて縞を流す
  const band = 0.25;
  const first = Math.floor(state.dist / band);
  for (let k = first + 12 * 4; k >= first - 2; k--) {
    const z0 = zOf(state, k * band);
    const z1 = zOf(state, (k + 1) * band);
    if (z1 <= 0.35 || z0 > FAR * 2) continue;
    const a = Math.max(0.35, z0);
    const [lx0, y0] = project(v, -0.02, a);
    const [rx0] = project(v, 1.02, a);
    const [lx1, y1] = project(v, -0.02, z1);
    const [rx1] = project(v, 1.02, z1);
    ctx.fillStyle = k % 2 ? '#f3f0ff' : '#e2ddf7';
    ctx.beginPath();
    ctx.moveTo(lx0, y0);
    ctx.lineTo(rx0, y0);
    ctx.lineTo(rx1, y1);
    ctx.lineTo(lx1, y1);
    ctx.fill();
  }
  // 道のふち
  for (const lane of [-0.02, 1.02]) {
    const [x0, y0] = project(v, lane, 0.4);
    const [x1, y1] = project(v, lane, FAR * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

// 群れの点は毎フレーム最大 140 × 3 個生成されるので、クロージャでなくデータで持って GC 負荷を抑える
type Draw = { z: number; draw: () => void } | { z: number; img: HTMLCanvasElement; x: number; y: number; size: number };

function crowdDraws(
  c: CanvasRenderingContext2D,
  v: View,
  lane: number,
  z: number,
  n: number,
  colors: readonly [string, string],
  now: number
): Draw[] {
  const dots = Math.min(n, MAX_DOTS);
  const center = crowdCenter(lane, n);
  const draws: Draw[] = [];
  for (let i = 0; i < dots; i++) {
    const d = 0.026 * Math.sqrt(i);
    const dl = Math.cos(i * GOLDEN) * d;
    const dz = Math.sin(i * GOLDEN) * d * 0.9;
    const pz = z + dz;
    if (pz < 0.4) continue;
    const [x, y, s] = project(v, center + dl, pz);
    const size = v.w * 0.075 * s;
    const frame = Math.floor(now * 10 + i * 0.37) % 2 === 0 ? 0 : 1;
    const bob = Math.abs(Math.sin(now * 16 + i)) * size * 0.08;
    draws.push({ z: pz, img: runner(colors[0], colors[1], frame), x, y: y - size * 0.45 - bob, size });
  }
  return draws;
}

/** 群れのいちばん奥の人の頭の上に、人数を出す */
function countTag(
  c: CanvasRenderingContext2D,
  v: View,
  lane: number,
  z: number,
  n: number,
  color: string,
  big: boolean,
  prefix = ''
) {
  const [x, y, s] = project(v, lane, z + crowdHalf(n) * 0.9);
  const size = v.w * (big ? 0.085 : 0.065) * Math.min(1.4, s);
  label(
    c,
    prefix + String(n),
    Math.min(v.w * 0.85, Math.max(v.w * 0.15, x)),
    y - v.w * 0.075 * s * 0.9 - size * 0.4,
    size,
    color
  );
}

export function paint(c: CanvasRenderingContext2D, state: GameState, v: View, now: number) {
  ground(c, v, state, now);
  const draws: Draw[] = [];

  // 道ばたの木。コースと一緒に流れてくる
  for (let k = Math.floor(state.dist / 0.8) - 1; k < state.dist / 0.8 + 10; k++) {
    const z = zOf(state, k * 0.8);
    if (z < 0.45 || z > FAR) continue;
    for (const lane of [-0.28, 1.28]) {
      draws.push({
        z,
        draw: () => {
          const [x, y, s] = project(v, lane, z);
          const size = v.w * 0.3 * s;
          stamp(c, tree(), x, y - size * 0.45, size);
        }
      });
    }
  }

  const castleZ = zOf(state, state.length) + 4;
  if (castleZ < FAR * 1.2) {
    draws.push({
      z: castleZ,
      draw: () => {
        const [x, y, s] = project(v, 0.5, castleZ);
        const size = v.w * 1.1 * s;
        stamp(c, castle(), x, y - size * 0.45, size);
      }
    });
  }

  for (const item of state.items) {
    if (item.done) continue;
    const z = zOf(state, item.at);
    if (z < 0.45 || z > FAR) continue;
    if (item.type === 'gates') {
      for (const [op, l0] of [
        [item.left, 0.02],
        [item.right, 0.51]
      ] as const) {
        draws.push({ z, draw: () => gate(c, v, op, l0, z, now) });
      }
    } else if (item.type === 'barrel') {
      draws.push({ z, draw: () => cask(c, v, item, z) });
    } else if (item.boss) {
      draws.push({ z, draw: () => giant(c, v, item.x, z, enemyCount(item.hp), now) });
    } else {
      const n = enemyCount(item.hp);
      draws.push(...crowdDraws(c, v, item.x, z, n, RED, now));
      draws.push({ z: z - 0.01, draw: () => countTag(c, v, item.x, z, n, '#d02c3e', false) });
    }
  }
  if (state.aim && state.count > 0) draws.push(...bullets(c, v, state, state.aim, now));

  if (state.count > 0) {
    draws.push(...crowdDraws(c, v, state.x, CROWD_Z, state.count, BLUE, now));
    draws.push({ z: 0.1, draw: () => countTag(c, v, state.x, CROWD_Z, state.count, '#0b6fcc', true) });
  }

  draws.sort((a, b) => b.z - a.z);
  for (const d of draws) {
    if ('draw' in d) d.draw();
    else stamp(c, d.img, d.x, d.y, d.size);
  }
}

function gate(c: CanvasRenderingContext2D, v: View, op: Op, l0: number, z: number, now: number) {
  const good = isGood(op);
  const [x0, y] = project(v, l0, z);
  const [x1, , s] = project(v, l0 + 0.47, z);
  const gh = v.w * 0.26 * s;
  const glass = c.createLinearGradient(0, y - gh, 0, y);
  glass.addColorStop(0, good ? 'rgb(120 200 255 / 0.85)' : 'rgb(255 140 150 / 0.85)');
  glass.addColorStop(1, good ? 'rgb(31 155 255 / 0.45)' : 'rgb(255 77 94 / 0.45)');
  c.fillStyle = glass;
  c.beginPath();
  c.roundRect(x0, y - gh, x1 - x0, gh, 10 * s);
  c.fill();
  // 光の帯が門の上を流れる
  const shine = ((now * 0.6 + l0) % 1.4) - 0.2;
  c.save();
  c.clip();
  c.fillStyle = 'rgb(255 255 255 / 0.35)';
  c.beginPath();
  const sx = x0 + (x1 - x0) * shine;
  c.moveTo(sx, y - gh);
  c.lineTo(sx + gh * 0.25, y - gh);
  c.lineTo(sx - gh * 0.15, y);
  c.lineTo(sx - gh * 0.4, y);
  c.fill();
  c.restore();
  c.lineWidth = Math.max(2, 7 * s);
  c.strokeStyle = '#fff';
  c.beginPath();
  c.roundRect(x0, y - gh, x1 - x0, gh, 10 * s);
  c.stroke();
  label(c, opText(op), (x0 + x1) / 2, y - gh / 2, v.w * 0.11 * s, good ? '#0b6fcc' : '#d02c3e');
}

/** 群れから撃っている相手へ流れる弾。人数が多いほど粒も多い */
function bullets(c: CanvasRenderingContext2D, v: View, state: GameState, aim: Item, now: number): Draw[] {
  const from = crowdCenter(state.x, state.count);
  const h = crowdHalf(state.count);
  const to = aim.type === 'gates' ? (state.x < 0.5 ? 0.25 : 0.75) : aim.x;
  const z1 = Math.max(CROWD_Z + 0.05, zOf(state, aim.at));
  const k = Math.min(36, 8 + Math.ceil(Math.sqrt(state.count) * state.power * 2));
  const draws: Draw[] = [];
  for (let i = 0; i < k; i++) {
    const t = (now * 2.6 + i / k) % 1;
    const lane = from + (((i * 0.618) % 1) - 0.5) * 2 * h * (1 - t) + (to - from) * t;
    const z = CROWD_Z + (z1 - CROWD_Z) * t;
    draws.push({
      z,
      draw: () => {
        const [x, y, s] = project(v, lane, z);
        c.fillStyle = '#ffe066';
        c.strokeStyle = '#ff9f1c';
        c.lineWidth = Math.max(1, 2 * s);
        c.beginPath();
        c.ellipse(x, y - v.w * 0.05 * s, v.w * 0.014 * s, v.w * 0.026 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    });
  }
  return draws;
}

/** 撃てば壊れる樽。残りの耐久と、中のごほうびを上に出す */
function cask(c: CanvasRenderingContext2D, v: View, item: Extract<Item, { type: 'barrel' }>, z: number) {
  const [x, y, s] = project(v, item.x, z);
  const size = BARREL_R * 3.2 * v.w * 0.92 * s;
  stamp(c, barrel(), x, y - size * 0.45, size);
  label(c, String(Math.ceil(item.hp)), x, y - size * 0.45, size * 0.38, '#6b3a1f');
  const top = y - size * 1.15;
  if (item.reward.kind === 'power') icon(c, 'bolt', x, top, size * 0.55);
  else label(c, `+${item.reward.n}`, x, top, size * 0.4, '#0b6fcc');
}

/** 城を守るボス。大きな 1 人で、頭の上に残りの人数を出す */
function giant(c: CanvasRenderingContext2D, v: View, lane: number, z: number, n: number, now: number) {
  const [x, y, s] = project(v, lane, z);
  const size = v.w * 0.5 * s;
  const bob = Math.abs(Math.sin(now * 5)) * size * 0.03;
  stamp(c, runner(RED[0], RED[1], Math.floor(now * 4) % 2 === 0 ? 0 : 1), x, y - size * 0.45 - bob, size);
  label(c, String(n), x, y - size * 0.95, v.w * 0.1 * Math.min(1.4, s), '#d02c3e');
}
