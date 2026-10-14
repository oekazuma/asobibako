import { SvelteSet } from 'svelte/reactivity';

/**
 * 決着の指を離した位置に結果画面のボタンが現れると、iOS Safari はそこへ合成 click を当てる。
 * preventDefault() では止まらず、リンクは SvelteKit のルーターが先に拾うので、
 * 盤面の指がすべて離れて少し経つまで、active の間は当たり判定そのものを消して下の要素に落とす
 */
export class Settle {
  active = $state(false);
  /** 画面に触れている指の pointerId。爆弾を握ったまま勝つゲームもあるので、決着の時点ではまだ指が残っていることがある */
  readonly #touching = new SvelteSet<number>();
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** 指がすべて離れていれば 350ms 後に、残っていても取りこぼしに備えて 3 秒後には必ず戻す */
  #after(ms: number) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.active = false), ms);
  }

  begin(): void {
    this.active = true;
    this.#after(this.#touching.size === 0 ? 350 : 3000);
  }

  /** onMount に渡す。戻り値で見張りをやめる */
  listen = (): (() => void) => {
    const press = (event: PointerEvent) => {
      // iPad の Safari は離した指の pointerup を届けないことがある。ほかに触れている指が無いなら、残っている指はもう離れている
      if (event.pointerType === 'touch' && event.isPrimary) this.#touching.clear();
      this.#touching.add(event.pointerId);
    };
    const lift = (event: PointerEvent) => {
      this.#touching.delete(event.pointerId);
      if (this.active && this.#touching.size === 0) this.#after(350);
    };
    addEventListener('pointerdown', press, true);
    addEventListener('pointerup', lift, true);
    addEventListener('pointercancel', lift, true);
    return () => {
      removeEventListener('pointerdown', press, true);
      removeEventListener('pointerup', lift, true);
      removeEventListener('pointercancel', lift, true);
      clearTimeout(this.#timer);
    };
  };
}
