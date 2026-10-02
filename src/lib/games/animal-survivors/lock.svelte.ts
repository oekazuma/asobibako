const SETTLE = 350;

/**
 * 3 択が出た直後だけカードの当たり判定を消す。iOS は離した指の位置へ合成 click を飛ばすので、
 * 出た瞬間と、出たときに画面に残っていた移動の指が離れた瞬間のあとを 350ms ずつ止める。
 * 共通の Settle は全部の指が離れるまで待つので、親指をスティックに置いたまま別の指で選ぶ持ち方だと 3 秒止まってしまう
 */
export class Lock {
  active = $state(false);
  #finger: number | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  #hold() {
    this.active = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.active = false), SETTLE);
  }

  /** finger は、出たときに画面に残っている移動の指の pointerId */
  begin(finger: number | null): void {
    this.#finger = finger;
    this.#hold();
  }

  lift(id: number): void {
    if (id !== this.#finger) return;
    this.#finger = null;
    this.#hold();
  }

  stop(): void {
    clearTimeout(this.#timer);
  }
}
