import type { Action } from 'svelte/action';
import { wake } from './audio.svelte';
import { Fingers, type Finger } from './fingers';

interface Hooks {
  down?: (event: PointerEvent, x: number, y: number) => void;
  move?: (event: PointerEvent, x: number, y: number) => void;
  up?: (event: PointerEvent, finger: Finger, x: number, y: number) => void;
}

/** app.css が .stage を回す条件と同じ。盤面が回っているかは、外接矩形から推し量るより CSS に聞くほうが確か */
export const TURNED_QUERY = '(orientation: landscape) and (pointer: coarse)';

/** 合成イベントや既に解放されたポインタでは失敗するが、掴み自体は続行してよい */
export function capture(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // noop
  }
}

interface Box {
  left: number;
  top: number;
  right: number;
  width: number;
  height: number;
}

/**
 * 画面上の座標を、盤面の幅・高さに対する 0..1 に直す。
 * turned は盤面が時計回りに 90 度回っているとき（app.css の .stage を landscape で回す）。
 * そのとき box（画面上の外接矩形）は、盤面の上辺が画面の右、左辺が画面の上に来ている
 */
export function toBoardPoint(clientX: number, clientY: number, box: Box, turned: boolean): [number, number] {
  if (turned) return [(clientY - box.top) / box.height, (box.right - clientX) / box.width];
  return [(clientX - box.left) / box.width, (clientY - box.top) / box.height];
}

/**
 * 盤面に置かれた指を、盤面の幅・高さに対する 0..1 の座標で追う。
 * 盤面の要素に down / move / up をそのまま渡し、pointercancel も up に渡す
 */
export class BoardInput {
  readonly fingers = new Fingers();
  #box: Box = { left: 0, top: 0, right: 1, width: 1, height: 1 };
  /** 回転する前の、盤面そのものの大きさ。描画の位置はこの座標系で書く */
  #size = { width: 1, height: 1 };
  #turned = false;
  /** 指（touch）の pointerId。ペンで描いているあいだに手のひらが触れても、ペンの指は忘れない */
  readonly #touches = new Set<number>();
  readonly #hooks: Hooks;

  constructor(hooks: Hooks = {}) {
    this.#hooks = hooks;
  }

  /** 盤面の座標を、盤面の中のピクセル位置に直す */
  px(x: number, y: number): [number, number] {
    return [x * this.#size.width, y * this.#size.height];
  }

  /** 画面上の点を盤面の 0..1 に直す。pointermove にまとめられた間のイベントにも使う */
  at(event: PointerEvent): [number, number] {
    return toBoardPoint(event.clientX, event.clientY, this.#box, this.#turned);
  }

  down = (event: PointerEvent) => {
    event.preventDefault();
    // iOS は操作イベントの中でしか音を鳴らし始められない
    wake();
    capture(event);
    // iPad の Safari は離した指の pointerup を届けないことがある。ほかに触れている指が無いなら、残っている指はもう離れている
    if (event.pointerType === 'touch' && event.isPrimary) this.#forget(event.timeStamp);
    const [x, y] = this.at(event);
    this.fingers.down(event.pointerId, x, y, event.timeStamp);
    if (event.pointerType === 'touch') this.#touches.add(event.pointerId);
    this.#hooks.down?.(event, x, y);
  };

  move = (event: PointerEvent) => {
    const [x, y] = this.at(event);
    this.fingers.move(event.pointerId, x, y, event.timeStamp);
    this.#hooks.move?.(event, x, y);
  };

  up = (event: PointerEvent) => {
    this.#touches.delete(event.pointerId);
    const [x, y] = this.at(event);
    const finger = this.fingers.up(event.pointerId, x, y, event.timeStamp);
    if (finger) this.#hooks.up?.(event, finger, x, y);
  };

  /**
   * いつどこで離したか分からない指なので、OS に取り上げられた指と同じ pointercancel として各ゲームの up へ渡す。
   * はじく速さや離した位置で決まることをさせない
   */
  #forget(t: number) {
    for (const id of this.#touches) {
      this.#touches.delete(id);
      const f = this.fingers.all.get(id);
      if (!f) continue;
      this.fingers.up(id, f.x, f.y, t);
      const event = { type: 'pointercancel', pointerId: id, pointerType: 'touch', timeStamp: t } as PointerEvent;
      this.#hooks.up?.(event, f, f.x, f.y);
    }
  }

  /** el の大きさを測り、変わるたびに onResize(幅 / 高さ) を呼ぶ。戻り値で見張りをやめる */
  observe(el: HTMLElement, onResize: (aspect: number) => void): () => void {
    const turned = matchMedia(TURNED_QUERY);
    const measure = () => {
      this.#box = el.getBoundingClientRect();
      this.#size = { width: el.offsetWidth, height: el.offsetHeight };
      this.#turned = turned.matches;
      if (this.#size.width === 0 || this.#size.height === 0) return;
      onResize(this.#size.width / this.#size.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // iPad を回しても .stage は幅と高さが入れ替わるだけで、盤面の大きさが変わらず ResizeObserver は知らせない
    turned.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      turned.removeEventListener('change', measure);
    };
  }

  /** 盤面の要素に use:input.board={onResize} と書けば、指の配線と大きさの見張りが付く */
  board: Action<HTMLElement, ((aspect: number) => void) | undefined> = (el, onResize = () => {}) => {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    const unobserve = this.observe(el, onResize);
    return {
      destroy: () => {
        el.removeEventListener('pointerdown', this.down);
        el.removeEventListener('pointermove', this.move);
        el.removeEventListener('pointerup', this.up);
        el.removeEventListener('pointercancel', this.up);
        unobserve();
      }
    };
  };
}
