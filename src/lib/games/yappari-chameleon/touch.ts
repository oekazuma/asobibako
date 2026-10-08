export type Mode = 'walk' | 'paint' | 'eye';
export type PaintEvent = { kind: 'start' | 'move' | 'end'; x: number; y: number } | { kind: 'cancel' };

/** 2 本指で触るつもりの 1 本めで塗ってしまわないよう、塗り始めるまで待つ時間と動き */
const HOLD_MS = 80;
const HOLD_PX = 6;
const STICK_AREA = 0.45;

interface Finger {
  x: number;
  y: number;
}

export class TouchPad {
  mode: Mode = 'walk';
  readonly stick = { x: 0, y: 0, active: false, ox: 0, oy: 0 };
  readonly #radius: number;
  #stickId: number | null = null;
  #lookId: number | null = null;
  #lookAt: Finger = { x: 0, y: 0 };
  #look = { dx: 0, dy: 0 };
  #fingers = new Map<number, Finger>();
  #pending: { id: number; x: number; y: number; t: number } | null = null;
  #painting: number | null = null;
  /** 2 本指のあと、全部の指が離れるまでは塗らない */
  #gesture = false;
  #orbit = { dx: 0, dy: 0, zoom: 1 };

  constructor(radius: number) {
    this.#radius = radius;
  }

  setMode(m: Mode): PaintEvent[] {
    const out: PaintEvent[] = this.#painting !== null ? [{ kind: 'cancel' }] : [];
    this.mode = m;
    this.#reset();
    return out;
  }

  #reset() {
    this.#stickId = this.#lookId = this.#painting = null;
    this.#pending = null;
    this.#gesture = false;
    this.#fingers.clear();
    Object.assign(this.stick, { x: 0, y: 0, active: false });
    this.#look = { dx: 0, dy: 0 };
    this.#orbit = { dx: 0, dy: 0, zoom: 1 };
  }

  /** orbit は塗るモードで、指を置いた所が体の外のとき（その指は塗らずにカメラを回す） */
  down(id: number, x: number, y: number, width: number, now: number, orbit = false): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintDown(id, x, y, now, orbit);
    if (this.#stickId === null && x < width * STICK_AREA) {
      this.#stickId = id;
      Object.assign(this.stick, { x: 0, y: 0, active: true, ox: x, oy: y });
    } else if (this.#lookId === null) {
      this.#lookId = id;
      this.#lookAt = { x, y };
    }
    return [];
  }

  move(id: number, x: number, y: number, now: number): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintMove(id, x, y, now);
    if (id === this.#stickId) {
      let dx = (x - this.stick.ox) / this.#radius;
      let dy = (y - this.stick.oy) / this.#radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.stick.x = dx;
      this.stick.y = dy;
    } else if (id === this.#lookId) {
      this.#look.dx += x - this.#lookAt.x;
      this.#look.dy += y - this.#lookAt.y;
      this.#lookAt = { x, y };
    }
    return [];
  }

  up(id: number): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintUp(id);
    if (id === this.#stickId) {
      this.#stickId = null;
      Object.assign(this.stick, { x: 0, y: 0, active: false });
    } else if (id === this.#lookId) this.#lookId = null;
    return [];
  }

  cancel(id: number): PaintEvent[] {
    if (this.mode === 'paint') {
      this.#fingers.delete(id);
      if (!this.#fingers.size) this.#gesture = false;
      if (this.#lookId === id) this.#lookId = null;
      if (this.#pending?.id === id) {
        this.#pending = null;
        return [];
      }
      if (this.#painting === id) {
        this.#painting = null;
        return [{ kind: 'cancel' }];
      }
      return [];
    }
    return this.up(id);
  }

  tick(now: number): PaintEvent[] {
    const p = this.#pending;
    if (!p || now - p.t < HOLD_MS) return [];
    this.#pending = null;
    this.#painting = p.id;
    return [{ kind: 'start', x: p.x, y: p.y }];
  }

  takeLook(): { dx: number; dy: number } {
    const l = this.#look;
    this.#look = { dx: 0, dy: 0 };
    return l;
  }

  takeOrbit(): { dx: number; dy: number; zoom: number } {
    const o = this.#orbit;
    this.#orbit = { dx: 0, dy: 0, zoom: 1 };
    return o;
  }

  #paintDown(id: number, x: number, y: number, now: number, orbit: boolean): PaintEvent[] {
    this.#fingers.set(id, { x, y });
    if (this.#fingers.size === 1 && !this.#gesture) {
      if (orbit) {
        this.#lookId = id;
        this.#lookAt = { x, y };
      } else this.#pending = { id, x, y, t: now };
      return [];
    }
    this.#gesture = true;
    this.#pending = null;
    this.#lookId = null;
    if (this.#painting !== null) {
      this.#painting = null;
      return [{ kind: 'cancel' }];
    }
    return [];
  }

  #paintMove(id: number, x: number, y: number, now: number): PaintEvent[] {
    const f = this.#fingers.get(id);
    if (!f) return [];
    if (this.#gesture && this.#fingers.size >= 2) {
      // Map の値は同じ物なので、動く前の座標を写しておく
      const [a, b] = [...this.#fingers.values()].map((p) => ({ ...p }));
      f.x = x;
      f.y = y;
      const [c, d] = [...this.#fingers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const after = Math.hypot(c.x - d.x, c.y - d.y) || 1;
      this.#orbit.dx += (c.x + d.x - a.x - b.x) / 2;
      this.#orbit.dy += (c.y + d.y - a.y - b.y) / 2;
      this.#orbit.zoom *= after / before;
      return [];
    }
    f.x = x;
    f.y = y;
    if (id === this.#lookId) {
      this.#look.dx += x - this.#lookAt.x;
      this.#look.dy += y - this.#lookAt.y;
      this.#lookAt = { x, y };
      return [];
    }
    const out: PaintEvent[] = [];
    const p = this.#pending;
    if (p && p.id === id && (now - p.t >= HOLD_MS || Math.hypot(x - p.x, y - p.y) >= HOLD_PX)) {
      out.push(...this.tick(Infinity));
    }
    if (this.#painting === id) out.push({ kind: 'move', x, y });
    return out;
  }

  #paintUp(id: number): PaintEvent[] {
    const f = this.#fingers.get(id);
    this.#fingers.delete(id);
    if (!this.#fingers.size) this.#gesture = false;
    if (this.#lookId === id) this.#lookId = null;
    if (this.#pending?.id === id) {
      // 動かさずに離したタップも 1 回は吹き付ける（点を打つ）
      this.#pending = null;
      return [
        { kind: 'start', x: f!.x, y: f!.y },
        { kind: 'end', x: f!.x, y: f!.y }
      ];
    }
    if (this.#painting === id && f) {
      this.#painting = null;
      return [{ kind: 'end', x: f.x, y: f.y }];
    }
    return [];
  }
}
