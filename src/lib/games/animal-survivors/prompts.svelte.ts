import { openChest, type Reward } from './chest';
import { WARN_AHEAD } from './bosses';
import { apply, choices, type Choice } from './choices';
import { ENEMIES } from './enemies';
import { Lock } from './lock.svelte';
import type { World } from './world';

/** ゲームを止めて重ねる画面（宝箱・3 択）と、WARNING の帯の出し入れ。宝箱は 3 択より先に開ける */
/** 群れの帯を出す秒 */
const NOTICE = 2;
/** ボスの登場で止める秒。カメラが寄る・札を見せる・戻るの 3 つ */
export const INTRO = 2.4;
const GO = 0.6;
const BACK = 1.8;
/** 動きを減らす設定では、カメラを動かさず札だけをこの秒出す */
const INTRO_STILL = 1.2;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (k: number) => k * k * (3 - 2 * k);

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
  /** 15:00 のクリアのあとの「延長戦へ・おわる」。答えは画面が受け取って閉じる */
  asking = $state(false);
  /** ボスの登場。t は端末の時間で進める（ゲームの時計は止まっている） */
  intro = $state<{ ids: number[]; t: number; epithet: string; name: string } | null>(null);
  /** ヌシの帯 */
  chief = $state<{ text: string; key: number; until: number } | null>(null);
  readonly #still: boolean;
  readonly lock = new Lock();
  readonly #w: World;

  constructor(w: World, still = reducedMotion()) {
    this.#w = w;
    this.#still = still;
    this.#sync();
  }

  #sync() {
    const w = this.#w;
    this.tools = { rerolls: w.rerolls, skips: w.skips, banishes: w.banishes };
  }

  get busy(): boolean {
    return this.options !== null || this.rewards !== null || this.asking || this.intro !== null;
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
      else if (e.type === 'chief') this.chief = { text: e.name, key: w.time, until: w.time + NOTICE };
      else if (e.type === 'bossIntro') {
        const defs = e.ids.map((i) => w.enemies[i].def);
        this.intro =
          defs.length > 1
            ? { ids: e.ids, t: 0, epithet: '面の主', name: defs.map((d) => d.name).join('・') }
            : { ids: e.ids, t: 0, epithet: defs[0].epithet ?? '', name: defs[0].name };
      } else if (e.type === 'grow') {
        const [from, to] = [w.animal.forms[e.form - 1], w.animal.forms[e.form]];
        this.notice = { text: `${from}は ${to}に育った！`, key: w.time, until: w.time + NOTICE };
      }
    // 倒していないボスが残ったまま次のボスが出ることがあるので、予告した数と倒した数で決める
    this.boss = w.warned > w.bossKills.length + w.swept;
    if (this.warning && w.time >= this.warning.until) this.warning = null;
    if (this.notice && w.time >= this.notice.until) this.notice = null;
    if (this.chief && w.time >= this.chief.until) this.chief = null;
  }

  /** 毎フレーム呼ぶ。finger は画面に残っている移動の指（出た直後の合成 click を捨てるため）。dt は端末の秒 */
  next(finger: number | null, dt = 0): void {
    const w = this.#w;
    if (this.intro) {
      this.intro.t += dt;
      if (this.intro.t < (this.#still ? INTRO_STILL : INTRO)) return;
      this.intro = null;
    }
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

  ask(finger: number | null): void {
    this.asking = true;
    this.lock.begin(finger);
  }

  answered(): void {
    this.asking = false;
  }

  close(finger: number | null): void {
    this.rewards = null;
    this.next(finger);
  }

  /** カメラの寄る先。登場でなければ null（自分を映す） */
  focus(w: World): { x: number; y: number } | null {
    const o = this.intro;
    if (!o || this.#still) return null;
    const live = o.ids.map((i) => w.enemies[i]);
    const to = {
      x: live.reduce((s, e) => s + e.x, 0) / live.length,
      y: live.reduce((s, e) => s + e.y, 0) / live.length
    };
    const p = w.player;
    const k = o.t < GO ? ease(o.t / GO) : o.t < BACK ? 1 : 1 - ease(Math.min(1, (o.t - BACK) / (INTRO - BACK)));
    return { x: p.x + (to.x - p.x) * k, y: p.y + (to.y - p.y) * k };
  }

  stop(): void {
    this.lock.stop();
  }
}
