import { openChest, type Reward } from './chest';
import { WARN_AHEAD } from './bosses';
import { apply, choices, type Choice } from './choices';
import { ENEMIES } from './enemies';
import { Lock } from './lock.svelte';
import type { World } from './world';

/** ゲームを止めて重ねる画面（宝箱・3 択）と、WARNING の帯の出し入れ。宝箱は 3 択より先に開ける */
/** 群れの帯を出す秒 */
const NOTICE = 2;

export class Prompts {
  options = $state<Choice[] | null>(null);
  rewards = $state<Reward[] | null>(null);
  /** key は帯を作り直すための数。until までゲームの時間で出す（3 択で止まっているあいだに消えないように） */
  warning = $state<{ name: string; key: number; until: number } | null>(null);
  /** 3 択の道具（引き直す・飛ばす・除外）の残り。World の値は $state でないので、画面のために写しを持つ */
  tools = $state({ rerolls: 0, skips: 0, banishes: 0 });
  /** 群れの帯。WARNING と同じくゲームの時間で出す */
  notice = $state<{ text: string; key: number; until: number } | null>(null);
  /** WARNING から、予告したボスを全部倒すまで（ボスの曲を流す） */
  boss = $state(false);
  readonly lock = new Lock();
  readonly #w: World;

  constructor(w: World) {
    this.#w = w;
    this.#sync();
  }

  #sync() {
    const w = this.#w;
    this.tools = { rerolls: w.rerolls, skips: w.skips, banishes: w.banishes };
  }

  get busy(): boolean {
    return this.options !== null || this.rewards !== null;
  }

  /** step のすぐあとに呼び、出来事から WARNING を拾い、ボスが出る時刻を過ぎたら消す */
  take(): void {
    const w = this.#w;
    for (const e of w.events)
      if (e.type === 'warning') {
        this.warning = { name: e.title ?? ENEMIES[e.boss].name, key: w.time, until: w.time + WARN_AHEAD };
      } else if (e.type === 'swarm' && e.text) this.notice = { text: e.text, key: w.time, until: w.time + NOTICE };
      else if (e.type === 'special')
        this.notice = { text: `${w.animal.forms[2]}の 専用進化！`, key: w.time, until: w.time + NOTICE };
      else if (e.type === 'rush') this.notice = { text: 'コインラッシュ！', key: w.time, until: w.time + NOTICE };
      else if (e.type === 'grow') {
        const [from, to] = [w.animal.forms[e.form - 1], w.animal.forms[e.form]];
        this.notice = { text: `${from}は ${to}に育った！`, key: w.time, until: w.time + NOTICE };
      }
    // 倒していないボスが残ったまま次のボスが出ることがあるので、予告した数と倒した数で決める
    this.boss = w.warned > w.bossKills.length;
    if (this.warning && w.time >= this.warning.until) this.warning = null;
    if (this.notice && w.time >= this.notice.until) this.notice = null;
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

  /** 3 択を引き直す。引き直した札も出た直後の合成 click を捨てる */
  reroll(finger: number | null): void {
    const w = this.#w;
    if (!this.options || w.rerolls <= 0) return;
    w.rerolls -= 1;
    this.#sync();
    this.options = choices(w);
    this.lock.begin(finger);
  }

  /** 何も取らずに 3 択を閉じる */
  skip(finger: number | null): void {
    const w = this.#w;
    if (!this.options || w.skips <= 0) return;
    w.skips -= 1;
    w.pending = Math.max(0, w.pending - 1);
    this.#sync();
    this.options = null;
    this.next(finger);
  }

  /** 札をその回の候補から消し、3 択を引き直す */
  banish(c: Choice, finger: number | null): void {
    const w = this.#w;
    if (!this.options || w.banishes <= 0 || c.kind === 'meat' || c.kind === 'bag') return;
    w.banishes -= 1;
    w.banished.push(`${c.kind}:${c.id}`);
    this.#sync();
    this.options = choices(w);
    this.lock.begin(finger);
  }

  close(finger: number | null): void {
    this.rewards = null;
    this.next(finger);
  }

  stop(): void {
    this.lock.stop();
  }
}
