import type { World } from './world';

export interface Shot {
  alive: boolean;
  slot: number;
  kind: 'shot' | 'boomerang' | 'homing' | 'orbit';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  r: number;
  dmg: number;
  pierce: number;
  hits: number[];
  angle: number;
}

export interface Effect {
  alive: boolean;
  slot: number;
  kind: 'swipe' | 'ring' | 'bolt' | 'burst';
  x: number;
  y: number;
  age: number;
  life: number;
  r: number;
  angle: number;
  born: number;
}

export const fire: (w: World, dt: number) => void = () => {};

export const hits: (w: World, dt: number) => void = () => {};
