import type { V3 } from '$lib/sculpt';
import { idle, newBody, step as move, type Body, type Level } from '../move';
import { NODES, nearest, route, type Node } from './paths';

/** 点に着いたとみなす距離（m） */
const ARRIVE = 0.3;
/** この秒のあいだに STUCK_GAIN も近づかなければ、止まって進めない */
const STUCK_SECS = 1;
const STUCK_GAIN = 0.1;

/** 網の点から点へ move.ts の step で歩く体 */
export class Walker {
  readonly body: Body;
  /** これから通る点。頭が次の行き先 */
  path: Node[] = [];
  /** 歩く速さ（入力の強さ。1 で WALK） */
  pace = 1;
  run = false;
  #prev: Node | null = null;
  #best = Infinity;
  #stuck = 0;
  readonly #blocked = new Set<string>();

  constructor(at: V3) {
    this.body = newBody(at);
  }

  go(to: Node): void {
    this.path = route(nearest(this.body.pos), to, this.#blocked);
    this.#reset();
  }

  step(lv: Level, dt: number): number | null {
    const next = this.path[0];
    if (next === undefined) {
      move(this.body, idle(), lv, dt);
      return null;
    }
    const at = NODES[next];
    const dx = at[0] - this.body.pos[0];
    const dz = at[2] - this.body.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < ARRIVE) {
      this.#prev = this.path.shift()!;
      this.#reset();
      move(this.body, idle(), lv, dt);
      // 着いたコマも、まだ道が残っていれば次の点の向きを返す（見回りが着いたと取り違えない）
      const then = this.path[0];
      if (then === undefined) return null;
      return Math.atan2(NODES[then][0] - this.body.pos[0], NODES[then][2] - this.body.pos[2]);
    }
    if (d < this.#best - STUCK_GAIN) {
      this.#best = d;
      this.#stuck = 0;
    } else if ((this.#stuck += dt) > STUCK_SECS) this.#unstick(next);
    move(this.body, { ...idle(), x: (dx / d) * this.pace, z: (dz / d) * this.pace, run: this.run }, lv, dt);
    return Math.atan2(dx, dz);
  }

  /** 進めない辺を覚え、ひとつ前の点へ戻ってから道を選び直す */
  #unstick(next: Node) {
    const goal = this.path.at(-1)!;
    const back = this.#prev ?? nearest(this.body.pos);
    this.#blocked.add(`${back}>${next}`);
    this.#blocked.add(`${next}>${back}`);
    this.path = [back, ...route(back, goal, this.#blocked).slice(1)];
    this.#reset();
  }

  #reset() {
    this.#best = Infinity;
    this.#stuck = 0;
  }
}
