import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { RGB } from '../color';
import type { Level } from '../move';
import type { Me } from '../net';
import type { View } from '../referee';

/** 体の表面の点。rest と normal は骨で曲げる前（吹き付けの Dab と同じ座標）、world と up（法線の y）はいまの屋敷の座標 */
export interface SurfacePoint {
  rest: V3;
  normal: V3;
  world: V3;
  up: number;
}

/** 光が当たる前の色（3D スポイトと同じ） */
export interface Paint {
  color: RGB;
  metal: number;
  rough: number;
}

/**
 * 頭脳が 3D に聞く口。アプリでは親の端末の 3D が答え、テストでは決め打ちの偽物を差す。
 * 3D が描けていない（縦持ちで描くのを止めている）あいだは null を返す
 */
export interface Senses {
  /** seat の体が eye から見えている画素のうち、まわりと diff より違う色に見える画素の割合（0..1）。by は見ている CPU（その体は描かない） */
  visible(seat: Seat, by: Seat, eye: V3, at: V3, diff: number): number | null;
  /** o から向き d（長さ 1）の先で最初に当たる屋敷の面の色と、その面のこちら側の法線の y */
  colorAt(o: V3, d: V3): (Paint & { up: number }) | null;
  /** seat の体の表面の点。3D の体がまだ body の場所に無ければ null */
  surface(seat: Seat, body: Me): SurfacePoint[] | null;
}

/** 頭脳に毎コマ渡すもの */
export interface Ctx {
  me: Seat;
  view: View;
  level: Level;
  /** ほかの人の最後の体（親が中継する） */
  bodies: ReadonlyMap<Seat, Me>;
  senses: Senses | null;
  /** 体と弾に付ける時刻（ミリ秒） */
  now: number;
  act(m: Message): void;
}
