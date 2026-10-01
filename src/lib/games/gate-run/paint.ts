import { icon, label, stamp } from '$lib/fx';
import { BARREL_R, crowdCenter, enemyCount, MAX_DOTS, type GameState, type Item } from './engine';
import { barrel, castle, foe, runner, tree } from './sprites';

/**
 * 群れの後ろの高いところから見下ろす遠近。群れから ahead 先の点は 1 / (1 + ahead × TILT) 倍に縮む。
 * 地平線は画面の上の外にあり、道の先の陣形まで見わたせる
 */
const TILT = 0.25;
const TOP = -0.3;
const BASE = 0.8;
const FAR = 10;
const GOLDEN = 2.39996;

const BLUE = ['#4db5ff', '#0b6fcc'] as const;

export interface View {
  w: number;
  h: number;
}

/** 道の横位置 lane（0..1）と群れからの距離 ahead を、画面の位置と倍率へ */
export function project(v: View, lane: number, ahead: number): [number, number, number] {
  const s = 1 / (1 + Math.max(-0.6, ahead) * TILT);
  return [v.w / 2 + (lane - 0.5) * v.w * 0.92 * s, v.h * (TOP + (BASE - TOP) * s), s];
}

export const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);

function ground(c: CanvasRenderingContext2D, v: View, state: GameState) {
  c.fillStyle = '#7fcf62';
  c.fillRect(0, 0, v.w, v.h);
  // 道は奥行きの帯ごとに台形で塗り、進んだ距離に合わせて縞を流す
  const band = 0.4;
  const first = Math.floor((state.dist - 1) / band);
  for (let k = first + Math.ceil((FAR + 1) / band); k >= first; k--) {
    const a0 = k * band - state.dist;
    const a1 = a0 + band;
    const [lx0, y0] = project(v, -0.02, a0);
    const [rx0] = project(v, 1.02, a0);
    const [lx1, y1] = project(v, -0.02, a1);
    const [rx1] = project(v, 1.02, a1);
    c.fillStyle = k % 2 ? '#f3f0ff' : '#e2ddf7';
    c.beginPath();
    c.moveTo(lx0, y0);
    c.lineTo(rx0, y0);
    c.lineTo(rx1, y1);
    c.lineTo(lx1, y1);
    c.fill();
  }
  c.strokeStyle = '#fff';
  c.lineWidth = 4;
  for (const lane of [-0.02, 1.02]) {
    const [x0, y0] = project(v, lane, -1);
    const [x1, y1] = project(v, lane, FAR + 1);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
}

// 群れの点は毎フレーム最大 140 × 3 個生成されるので、クロージャでなくデータで持って GC 負荷を抑える
type Draw = { z: number; draw: () => void } | { z: number; img: HTMLCanvasElement; x: number; y: number; size: number };

function crowdDraws(v: View, lane: number, ahead: number, n: number, enemy: boolean, now: number): Draw[] {
  const dots = Math.min(n, MAX_DOTS);
  const draws: Draw[] = [];
  for (let i = 0; i < dots; i++) {
    const d = 0.026 * Math.sqrt(i);
    const pz = ahead + Math.sin(i * GOLDEN) * d * 0.9;
    const [x, y, s] = project(v, lane + Math.cos(i * GOLDEN) * d, pz);
    const size = v.w * 0.075 * s;
    const frame = Math.floor(now * 10 + i * 0.37) % 2 === 0 ? 0 : 1;
    const bob = Math.abs(Math.sin(now * 16 + i)) * size * 0.08;
    const img = enemy ? foe(frame) : runner(BLUE[0], BLUE[1], frame);
    draws.push({ z: pz, img, x, y: y - size * 0.45 - bob, size });
  }
  return draws;
}

/** 群れのいちばん奥の人の頭の上に、人数を出す */
function countTag(c: CanvasRenderingContext2D, v: View, lane: number, ahead: number, n: number, color: string) {
  const [x, y, s] = project(v, lane, ahead + 0.026 * Math.sqrt(Math.min(n, MAX_DOTS)) * 0.9);
  const size = v.w * 0.075 * Math.min(1.3, s);
  label(c, String(n), Math.min(v.w * 0.85, Math.max(v.w * 0.15, x)), y - v.w * 0.075 * s - size * 0.4, size, color);
}

export function paint(c: CanvasRenderingContext2D, state: GameState, v: View, now: number) {
  ground(c, v, state);
  const draws: Draw[] = [];
  const ahead = (at: number) => at - state.dist;

  // 道ばたの木。コースと一緒に流れてくる
  for (let k = Math.floor(state.dist / 0.9) - 1; k < (state.dist + FAR) / 0.9; k++) {
    const z = ahead(k * 0.9);
    if (z < -0.8) continue;
    for (const lane of [-0.22, 1.22]) {
      draws.push({
        z,
        draw: () => {
          const [x, y, s] = project(v, lane, z);
          const size = v.w * 0.26 * s;
          stamp(c, tree(), x, y - size * 0.45, size);
        }
      });
    }
  }

  const castleZ = ahead(state.length + 4.5);
  if (castleZ < FAR) {
    draws.push({
      z: castleZ,
      draw: () => {
        const [x, y, s] = project(v, 0.5, castleZ);
        const size = v.w * 0.9 * s;
        stamp(c, castle(), x, y - size * 0.45, size);
      }
    });
  }

  for (const item of state.items) {
    const z = ahead(item.at);
    if (item.done || z < -0.6 || z > FAR) continue;
    if (item.type === 'gate') draws.push({ z, draw: () => gate(c, v, item, z) });
    else if (item.type === 'barrel') draws.push({ z, draw: () => cask(c, v, item, z) });
    else {
      const n = enemyCount(item.hp);
      draws.push(...crowdDraws(v, item.x, z, n, true, now));
      draws.push({ z: z - 0.01, draw: () => countTag(c, v, item.x, z, n, '#d02c3e') });
    }
  }

  if (state.count > 0) {
    const x = crowdCenter(state.x, state.count);
    draws.push(...crowdDraws(v, x, 0, state.count, false, now));
    draws.push({ z: -0.5, draw: () => countTag(c, v, x, 0, state.count, '#0b6fcc') });
    draws.push(...bullets(c, v, state, now));
  }

  draws.sort((a, b) => b.z - a.z);
  for (const d of draws) {
    if ('draw' in d) d.draw();
    else stamp(c, d.img, d.x, d.y, d.size);
  }
}

/** 道の半分にかかる横長の門。数が負なら赤、0 以上なら青 */
function gate(c: CanvasRenderingContext2D, v: View, item: Extract<Item, { type: 'gate' }>, z: number) {
  const good = item.n >= 0;
  const [x0, y, s] = project(v, item.x0, z);
  const [x1] = project(v, item.x1, z);
  const bh = v.w * 0.075 * s;
  const top = y - v.w * 0.06 * s - bh;
  c.fillStyle = '#5d6275';
  for (const x of [x0, x1]) c.fillRect(x - 2.5 * s, top, 5 * s, y - top);
  const fill = c.createLinearGradient(0, top, 0, top + bh);
  fill.addColorStop(0, good ? '#6cc4ff' : '#ff8a95');
  fill.addColorStop(1, good ? '#1f7fe0' : '#d33445');
  c.fillStyle = fill;
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(2, 5 * s);
  c.beginPath();
  c.roundRect(x0, top, x1 - x0, bh, 6 * s);
  c.fill();
  c.stroke();
  label(c, signed(item.n), (x0 + x1) / 2, top + bh / 2, bh * 0.85, good ? '#0b6fcc' : '#d02c3e');
}

/** 弾。群れの列ごとに、当たる相手まで光の筋が流れる */
function bullets(c: CanvasRenderingContext2D, v: View, state: GameState, now: number): Draw[] {
  const draws: Draw[] = [];
  const per = Math.min(4, 1 + Math.floor(Math.sqrt(state.count * state.power) / 3));
  state.shots.forEach((shot, i) => {
    const to = Math.max(0.2, shot.at - state.dist);
    for (let j = 0; j < per; j++) {
      const t = (now * 3 + i * 0.37 + j / per) % 1;
      const z = to * t;
      draws.push({
        z,
        draw: () => {
          const [x, y, s] = project(v, shot.x, z);
          const [, y2] = project(v, shot.x, Math.max(0, z - 0.35));
          c.strokeStyle = '#ffb347';
          c.lineCap = 'round';
          c.lineWidth = Math.max(1.5, v.w * 0.008 * s);
          c.beginPath();
          c.moveTo(x, y - v.w * 0.05 * s);
          c.lineTo(x, y2 - v.w * 0.05 * s);
          c.stroke();
        }
      });
    }
  });
  return draws;
}

/** 撃てば壊れる樽。残りの耐久を胴に、中のごほうびを上に出す */
function cask(c: CanvasRenderingContext2D, v: View, item: Extract<Item, { type: 'barrel' }>, z: number) {
  const [x, y, s] = project(v, item.x, z);
  const size = BARREL_R * 2 * v.w * 0.92 * s;
  stamp(c, barrel(), x, y - size * 0.45, size);
  label(c, String(Math.ceil(item.hp)), x, y - size * 0.4, size * 0.36, '#6b3a1f');
  const top = y - size * 1.05;
  if (item.reward.kind === 'power') icon(c, 'bolt', x, top, size * 0.6);
  else {
    stamp(c, runner(BLUE[0], BLUE[1], 0), x, top, size * 0.6);
    label(c, `+${item.reward.n}`, x, top - size * 0.45, size * 0.3, '#0b6fcc');
  }
}
