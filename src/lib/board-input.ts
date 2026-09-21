import { wake } from './audio.svelte';
import { Fingers, type Finger } from './fingers';

interface Hooks {
  down?: (event: PointerEvent, x: number, y: number) => void;
  up?: (event: PointerEvent, finger: Finger, x: number, y: number) => void;
}

/**
 * 盤面に置かれた指を、盤面の幅・高さに対する 0..1 の座標で追う。
 * 盤面の要素に down / move / up をそのまま渡し、pointercancel も up に渡す
 */
export class BoardInput {
  readonly fingers = new Fingers();
  #rect = { left: 0, top: 0, width: 1, height: 1 };
  readonly #hooks: Hooks;

  constructor(hooks: Hooks = {}) {
    this.#hooks = hooks;
  }

  /** 盤面の座標を、盤面の中のピクセル位置に直す */
  px(x: number, y: number): [number, number] {
    return [x * this.#rect.width, y * this.#rect.height];
  }

  #toBoard(event: PointerEvent): [number, number] {
    return [(event.clientX - this.#rect.left) / this.#rect.width, (event.clientY - this.#rect.top) / this.#rect.height];
  }

  down = (event: PointerEvent) => {
    event.preventDefault();
    // iOS は操作イベントの中でしか音を鳴らし始められない
    wake();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // 合成イベントでは捕捉できないが、指の追跡自体は続けられる
    }
    const [x, y] = this.#toBoard(event);
    this.fingers.down(event.pointerId, x, y, event.timeStamp);
    this.#hooks.down?.(event, x, y);
  };

  move = (event: PointerEvent) => {
    const [x, y] = this.#toBoard(event);
    this.fingers.move(event.pointerId, x, y, event.timeStamp);
  };

  up = (event: PointerEvent) => {
    const [x, y] = this.#toBoard(event);
    const finger = this.fingers.up(event.pointerId, x, y, event.timeStamp);
    if (finger) this.#hooks.up?.(event, finger, x, y);
  };

  /** el の大きさを測り、変わるたびに onResize(幅 / 高さ) を呼ぶ。戻り値で見張りをやめる */
  observe(el: HTMLElement, onResize: (aspect: number) => void): () => void {
    const measure = () => {
      this.#rect = el.getBoundingClientRect();
      onResize(this.#rect.width / this.#rect.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }
}
