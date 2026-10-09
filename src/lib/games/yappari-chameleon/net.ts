import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { Cling } from './move';
import type { Dab, PaintLog } from './paint';

/** このゲームの知らせの形の版。形を変えたら 1 上げる（Party の PROTOCOL とは別） */
export const CHAMELEON_VERSION = 1;
export const SEND_MS = 50;
export const DELAY_MS = 100;
/** 1 回の知らせの上限。DataChannel の上限（256KB）より十分小さく */
export const CHUNK = 32 * 1024;
// 位置 3・向き 3・半径・色 3・不透明度・メタリック・ラフネス
export const DAB_LEN = 13;

export interface Me {
  ms: number;
  pos: V3;
  yaw: number;
  cling: Cling | null;
  pose: string;
  crouch: boolean;
  paint: boolean;
  look: [number, number];
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r3 = (v: number) => Math.round(v * 1e3) / 1e3;

export function packDabs(dabs: readonly Dab[]): number[] {
  const out: number[] = [];
  for (const d of dabs) out.push(...d.p.map(r4), ...d.n.map(r4), r4(d.r), ...d.c.map(r3), r3(d.a), r3(d.m), r3(d.ro));
  return out;
}

export function unpackDabs(flat: readonly number[]): Dab[] {
  const out: Dab[] = [];
  for (let i = 0; i + DAB_LEN <= flat.length; i += DAB_LEN) {
    const f = flat.slice(i, i + DAB_LEN);
    out.push({
      p: [f[0], f[1], f[2]],
      n: [f[3], f[4], f[5]],
      r: f[6],
      c: [f[7], f[8], f[9]],
      a: f[10],
      m: f[11],
      ro: f[12]
    });
  }
  return out;
}

export function chunks(flat: readonly number[], limit = CHUNK): number[][] {
  const out: number[][] = [];
  let part: number[] = [];
  let size = 64;
  for (let i = 0; i < flat.length; i += DAB_LEN) {
    const one = flat.slice(i, i + DAB_LEN);
    const len = one.reduce((n, v) => n + String(v).length + 1, 0);
    if (part.length && size + len > limit) {
      out.push(part);
      part = [];
      size = 64;
    }
    part.push(...one);
    size += len;
  }
  out.push(part);
  return out;
}

export function dabMessages(seat: Seat, at: number, flat: readonly number[]): Message[] {
  let from = at;
  return chunks(flat).map((d) => {
    const m = { t: 'dabs', seat, at: from, d };
    from += d.length / DAB_LEN;
    return m;
  });
}

/**
 * 受けた吹き付けを列へ入れる。at が今の長さより長ければ取りこぼしなので捨てる（null）。
 * 縮めた（もどす・塗り直し）なら 'rebuild'、足しただけなら 'append'
 */
export function splice<T>(log: T[], at: number, add: readonly T[]): 'append' | 'rebuild' | null {
  if (at > log.length) return null;
  const cut = at < log.length;
  log.length = at;
  log.push(...add);
  return cut ? 'rebuild' : 'append';
}

export class DabOutbox {
  #sent = 0;

  take(log: PaintLog): { at: number; d: number[] } | null {
    const at = Math.min(this.#sent, log.low);
    log.low = Infinity;
    if (at === this.#sent && at === log.dabs.length) return null;
    this.#sent = log.dabs.length;
    return { at, d: packDabs(log.dabs.slice(at)) };
  }

  /** 親から自分の列を受け取った（戻ったとき）。送り直さない */
  adopt(log: PaintLog): void {
    this.#sent = log.dabs.length;
    log.low = Infinity;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Timeline の前後の値のあいだ。ポーズと張り付きのような段のある値は近いほうを取る */
export function lerpMe(a: Me, b: Me, t: number): Me {
  const near = t < 0.5 ? a : b;
  return {
    ...near,
    ms: lerp(a.ms, b.ms, t),
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    yaw: lerpAngle(a.yaw, b.yaw, t),
    look: [lerpAngle(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t)]
  };
}
