export type Vec = { x: number; y: number };
const ZERO: Vec = { x: 0, y: 0 };

function unit(x: number, y: number): Vec {
  const len = Math.hypot(x, y);
  return len === 0 ? ZERO : { x: x / len, y: y / len };
}

/** KeyboardEvent.code の集合から。WASD と矢印キーは同じ向き */
export function keyVector(keys: ReadonlySet<string>): Vec {
  const has = (...k: string[]) => k.some((c) => keys.has(c));
  const x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0);
  return unit(x, y);
}

/** 指を置いた所からのずれ。半径の 15% までは遊び、半径より外は長さ 1 */
export function stickVector(dx: number, dy: number, radius: number): Vec {
  const len = Math.hypot(dx, dy) / radius;
  if (len < 0.15) return ZERO;
  const k = Math.min(1, len) / (len * radius);
  return { x: dx * k, y: dy * k };
}

/** ゲームパッドの左スティック。遊びは 0.2 */
export function padVector(axes: readonly number[] | undefined): Vec {
  const [x = 0, y = 0] = axes ?? [];
  const len = Math.hypot(x, y);
  if (len < 0.2) return ZERO;
  const k = Math.min(1, len) / len;
  return { x: x * k, y: y * k };
}

/** 先に 0 でないものを使う。呼ぶ側は指・キー・パッドの順に渡す */
export function pick(...vs: Vec[]): Vec {
  return vs.find((v) => v.x !== 0 || v.y !== 0) ?? ZERO;
}
