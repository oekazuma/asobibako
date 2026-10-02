import { openChest, type Reward } from './chest';
import { apply, choices, type Choice } from './choices';
import { ENEMIES } from './enemies';
import { Lock } from './lock.svelte';
import type { World } from './world';

const WARNING_SHOW = 3000;

/** ゲームを止めて重ねる画面（宝箱・3 択）と、WARNING の帯の出し入れ。宝箱は 3 択より先に開ける */
export class Prompts {
  options = $state<Choice[] | null>(null);
  rewards = $state<Reward[] | null>(null);
  /** key は帯を作り直すための数 */
  warning = $state<{ name: string; key: number } | null>(null);
  readonly lock = new Lock();
  readonly #w: World;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(w: World) {
    this.#w = w;
  }

  get busy(): boolean {
    return this.options !== null || this.rewards !== null;
  }

  /** step のすぐあとに呼び、出来事から WARNING を拾う */
  take(): void {
    for (const e of this.#w.events) {
      if (e.type !== 'warning') continue;
      this.warning = { name: ENEMIES[e.boss].name, key: this.#w.time };
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => (this.warning = null), WARNING_SHOW);
    }
  }

  /** 毎フレーム呼ぶ。finger は画面に残っている移動の指（出た直後の合成 click を捨てるため） */
  next(finger: number | null): void {
    const w = this.#w;
    if (this.busy || w.over) return;
    if (w.chests > 0) this.rewards = openChest(w);
    else if (w.pending > 0) this.options = choices(w);
    else return;
    this.lock.begin(finger);
  }

  choose(c: Choice, finger: number | null): void {
    apply(this.#w, c);
    this.options = null;
    this.next(finger);
  }

  close(finger: number | null): void {
    this.rewards = null;
    this.next(finger);
  }

  stop(): void {
    this.lock.stop();
    clearTimeout(this.#timer);
  }
}
