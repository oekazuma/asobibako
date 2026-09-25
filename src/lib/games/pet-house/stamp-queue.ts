import { BADGE_LIFE } from './effects';
import type { Core } from './core';
import { sounds } from './sounds';
import { nearly, type Stamp } from './stamps';

/** スタンプ帳のスタンプを、1 つずつ間をあけて画面に押す列 */
export class StampQueue {
  readonly #c: Core;
  /** ほかに言うことがない（気分の一言が無い）か。あと少しのスタンプを知らせてよい */
  readonly #quiet: () => boolean;
  /**
   * 押すのを待つスタンプ。配列は開いた直後の判定でまとめて見つかったもの
   * （前の版の保存で満たしていた分）で、1 つずつ押すと長く続くので 1 回の演出にまとめる
   */
  #list: (Stamp | Stamp[])[] = [];
  /** 開いた直後は「よみこみちゅう」の下で押してしまわないよう少し待つ */
  #wait = 3;
  #nudged = 0;

  constructor(core: Core, quiet: () => boolean) {
    this.#c = core;
    this.#quiet = quiet;
  }

  add(...items: (Stamp | Stamp[])[]) {
    this.#list.push(...items);
  }

  /**
   * たまったスタンプを 1 つずつ押す。シートの下・移動中・遊びのモードの HUD の上では見えにくいので、部屋か公園に戻るまで待つ。
   * あと少しで押せるものは、ほかに言うことがないときだけ 2 分半に 1 回ほど知らせる
   */
  tick(dt: number) {
    const c = this.#c;
    const s = c.s;
    this.#wait -= dt;
    if (this.#list.length && this.#wait <= 0 && !s.covered && !s.moving && !s.activity)
      this.#press(this.#list.shift()!);
    if (s.activity || s.covered || s.toast || c.now - this.#nudged < 150) return;
    this.#nudged = c.now;
    const near = this.#quiet() && nearly(s.save);
    if (near) c.say(`あと すこしで スタンプ「${near.name}」が もらえるよ`, 4);
  }

  #press(item: Stamp | Stamp[]) {
    const c = this.#c;
    const list = [item].flat();
    const one = list.length === 1 ? list[0] : null;
    const reward = list.reduce((sum, s) => sum + (s.reward ?? 0), 0);
    const coins = reward ? ` +${reward}コイン` : '';
    this.#wait = BADGE_LIFE + 0.4;
    // 描く回数を落とすと押される動きがかくつくので、指で遊んでいるときと同じにする
    c.smooth();
    const r = Math.max(48, Math.min(90, Math.min(c.w, c.h) * 0.13));
    const [x, y] = [c.w / 2, c.h * 0.34];
    if (one) c.fx.stamp(one.name, one.icon, one.color, x, y, r);
    else c.fx.stamp(`スタンプ ${list.length}こ`, 'star', '#ffc233', x, y, r);
    sounds.stamp();
    if (reward) setTimeout(() => c.fx.coins(x, y, c.purse(), one ? 6 : 12), 900);
    if (one) c.say(`スタンプ ゲット！${coins}`, 4);
    else c.say(`これまでの がんばりで スタンプが ${list.length}こ もらえたよ！${coins}`, 6);
  }
}
