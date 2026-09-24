import type { BaseScene } from './types';

/**
 * 部屋と公園の置き場所。単位はメートルで、x が右、z が手前（カメラ側）、y が高さ。
 * ペットの行動（behavior.ts）と 3D（scenes.ts / world3d.ts）が同じ数字を使う
 */

export interface Spot {
  x: number;
  z: number;
}

/** ペットが通れない丸 */
export interface Block extends Spot {
  r: number;
}

export interface Layout {
  /** ペットが歩ける範囲 */
  bounds: { x0: number; x1: number; z0: number; z1: number };
  /** 呼ぶと来る場所、投げたおもちゃを持ってくる場所。カメラのすぐ前 */
  front: Spot;
  blocks: Block[];
  camera: { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number; fov: number };
}

export interface RoomLayout extends Layout {
  food: Spot;
  water: Spot;
  bed: Spot;
}

/** 縦長の画面で見るので、部屋は横に狭く奥に長い */
export const ROOM: RoomLayout = {
  bounds: { x0: -1.4, x1: 1.4, z0: -1.6, z1: 1.1 },
  front: { x: 0, z: 0.8 },
  food: { x: 1.1, z: -1.4 },
  water: { x: 1.1, z: -0.95 },
  bed: { x: -1.05, z: -1.3 },
  blocks: [
    // ソファ（奥の壁ぎわ）と観葉植物（右奥の角）
    { x: -0.05, z: -2.0, r: 0.45 },
    { x: 0.55, z: -2.0, r: 0.3 },
    { x: 1.35, z: -1.95, r: 0.25 }
  ],
  camera: { x: 0, y: 1.35, z: 2.7, lookX: 0, lookY: 0.1, lookZ: -0.4, fov: 42 }
};

export const PARK: Layout = {
  bounds: { x0: -2.6, x1: 2.6, z0: -6, z1: 1.2 },
  front: { x: 0, z: 0.9 },
  blocks: [
    { x: -2.2, z: -3.2, r: 0.35 },
    { x: 2.0, z: -4.6, r: 0.35 },
    { x: 1.7, z: -1.6, r: 0.3 },
    { x: -1.4, z: -5.4, r: 0.3 }
  ],
  camera: { x: 0, y: 0.95, z: 2.9, lookX: 0, lookY: 0.25, lookZ: -0.6, fov: 44 }
};

export const LAYOUTS: Record<BaseScene, Layout> = { room: ROOM, park: PARK };
