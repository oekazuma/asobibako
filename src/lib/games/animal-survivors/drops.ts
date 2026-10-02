import type { Enemy, World } from './world';

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}

export interface Item {
  alive: boolean;
  kind: 'meat' | 'magnet';
  x: number;
  y: number;
  pulled: boolean;
}

export const dropFrom: (w: World, e: Enemy) => void = () => {};

export const collect: (w: World, dt: number) => void = () => {};
