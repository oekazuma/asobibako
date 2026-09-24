import { cloud, label, stamp } from '$lib/fx';
import { crowdCenter, crowdHalf, isGood, MAX_DOTS, SAW_R, sawX, type GameState, type Op } from './engine';
import { castle, runner, tree } from './sprites';

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
const GRAY = ['#d3d6e0', '#8a8fa3'] as const;

export interface View {
  w: number;
  h: number;
}

/** 道の横位置 lane（0..1）と奥行き z を画面の位置と倍率へ */
export function project(v: View, lane: number, z: number): [number, number, number] {
  const s = 1 / z;
  return [v.w / 2 + (lane - 0.5) * v.w * 0.92 * s, v.h * HORIZON + v.h * 0.5 * s, s];
}

const zOf = (state: GameState, at: number) => (at - state.dist) * DEPTH + CROWD_Z;
const opText = (op: Op) => `${op.kind === 'x' ? '×' : op.kind}${op.n}`;

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

  const goalZ = zOf(state, state.length) + 0.5;
  if (goalZ < FAR) {
    draws.push({
      z: goalZ + 0.3,
      draw: () => {
        const [x, y, s] = project(v, 0.5, goalZ + 0.3);
        const size = v.w * 0.9 * s;
        stamp(c, castle(), x, y - size * 0.45, size);
      }
    });
    draws.push(...crowdDraws(c, v, 0.5, goalZ, state.boss, RED, now));
    draws.push({ z: goalZ - 0.01, draw: () => countTag(c, v, 0.5, goalZ, state.boss, '#d02c3e', true) });
  }

  for (const item of state.items) {
    if (item.type === 'gates') {
      const z = zOf(state, item.at);
      if (item.done || z < 0.45 || z > FAR) continue;
      for (const [op, l0] of [
        [item.left, 0.02],
        [item.right, 0.51]
      ] as const) {
        draws.push({ z, draw: () => gate(c, v, op, l0, z, now) });
      }
    } else if (item.type === 'saw' || item.type === 'wall' || item.type === 'ally') {
      const z = zOf(state, item.at);
      if (item.done || z < 0.45 || z > FAR) continue;
      if (item.type === 'ally') {
        draws.push(...crowdDraws(c, v, item.x, z, item.n, GRAY, now));
        draws.push({ z: z - 0.01, draw: () => countTag(c, v, item.x, z, item.n, '#6b6f86', false, '+') });
      } else if (item.type === 'saw') draws.push({ z, draw: () => saw(c, v, sawX(item, state.dist), z, now) });
      else draws.push({ z, draw: () => fence(c, v, item.gap, item.width, z) });
    } else {
      const fighting = state.fight?.item === item;
      if (item.done && !fighting) continue;
      const n = fighting ? state.fight!.n : item.n;
      const z = fighting ? CROWD_Z + 0.35 : zOf(state, item.at) + 0.2;
      if (n <= 0 || z > FAR) continue;
      draws.push(...crowdDraws(c, v, item.x, z, n, RED, now));
      draws.push({ z: z - 0.01, draw: () => countTag(c, v, item.x, z, n, '#d02c3e', false) });
    }
  }

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

/** レールの上を左右に動く、立った回転ノコギリ */
function saw(c: CanvasRenderingContext2D, v: View, lane: number, z: number, now: number) {
  const [l0, y, s] = project(v, 0.04, z);
  const [l1] = project(v, 0.96, z);
  c.fillStyle = '#6b6f86';
  c.fillRect(l0, y - 6 * s, l1 - l0, 12 * s);
  const [x] = project(v, lane, z);
  const r = SAW_R * v.w * 0.92 * s;
  c.save();
  c.translate(x, y - r);
  c.rotate(now * 12);
  c.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? r : r * 0.82;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = '#d7dbe7';
  c.fill();
  c.lineWidth = Math.max(1.5, 3 * s);
  c.strokeStyle = '#5d6275';
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  c.fillStyle = '#ff4d5e';
  c.fill();
  c.restore();
}

/** すき間のあいたトゲの柵。すき間の外にはみ出た仲間が減る */
function fence(c: CanvasRenderingContext2D, v: View, gap: number, width: number, z: number) {
  const [, y, s] = project(v, 0.5, z);
  const h = v.w * 0.07 * s;
  for (const [a, b] of [
    [0.02, gap - width / 2],
    [gap + width / 2, 0.98]
  ]) {
    if (b <= a) continue;
    const [x0] = project(v, a, z);
    const [x1] = project(v, b, z);
    c.fillStyle = '#8a4b2a';
    c.fillRect(x0, y - h * 0.45, x1 - x0, h * 0.45);
    const n = Math.max(1, Math.round((x1 - x0) / (h * 0.7)));
    c.fillStyle = '#d7dbe7';
    c.strokeStyle = '#5d6275';
    c.lineWidth = Math.max(1, 2 * s);
    for (let i = 0; i < n; i++) {
      const sx = x0 + ((i + 0.5) / n) * (x1 - x0);
      c.beginPath();
      c.moveTo(sx - h * 0.3, y - h * 0.45);
      c.lineTo(sx, y - h * 1.2);
      c.lineTo(sx + h * 0.3, y - h * 0.45);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
}
