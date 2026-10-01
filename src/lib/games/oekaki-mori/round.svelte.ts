import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { Bubble } from './Bubbles.svelte';
import type { View } from './engine';
import type { Drawing, Miss } from './Result.svelte';
import { sounds } from './sounds';
import { apply, type Ink, type Stroke } from './strokes';
import type { Screen } from './sync';
import { typed } from './typing';

/** 同時に浮かべるスタンプの数。あふれたら古いものから消す */
const MAX_STAMPS = 6;
const STAMP_MS = 2000;
/** 描く時間の残りがこれ以下になったら、1 秒ごとに音を鳴らす */
const TICK_FROM = 10;
const HIGH_FROM = 3;

/** 親から届いた知らせで変わる、遊んでいるあいだの画面の状態 */
export class Round {
  screen = $state<Screen>('lobby');
  view = $state.raw<View | null>(null);
  strokes = $state.raw<Stroke[]>([]);
  bubbles = $state.raw<Bubble[]>([]);
  gallery = $state.raw<Drawing[]>([]);
  /** 当てる人ごとの打っている字。描く人にはそのまま、ほかの人には字数だけ届く */
  typing = $state.raw<Record<number, string>>({});
  stamps = $state.raw<{ key: number; seat: Seat; id: string }[]>([]);
  close = $state(false);
  /** いまの番に外れた答え。答えを見せるときに絵と一緒に残す */
  #misses: Miss[] = [];
  #key = 0;

  /** つなぎ直すとき。前のつながりの見え方が残ると、番が変わったとみなして送り直された絵を消してしまう */
  reset() {
    this.view = null;
    this.strokes = [];
    this.gallery = [];
    this.typing = {};
    this.bubbles = [];
    this.stamps = [];
    this.#misses = [];
  }

  receive(m: Message) {
    if (m.t === 'screen') {
      this.screen = m.screen as Screen;
      this.view = null;
      this.strokes = [];
      this.gallery = [];
      // 1 人が抜けて終わった遊びは番が進まないので、ここで消さないと次の遊びの最初の絵に混ざる
      this.typing = {};
      this.#misses = [];
    } else if (m.t === 'view') this.#show(m.view as View);
    else if (m.t === 'ink') this.strokes = apply(this.strokes, m.ink as Ink);
    else if (m.t === 'sync') {
      this.strokes = m.strokes as Stroke[];
      this.gallery = [];
    } else if (m.t === 'drawing') this.gallery = [...this.gallery, m.drawing as Drawing];
    else if (m.t === 'typing') this.typing = typed(this.typing, Number(m.seat), String(m.text));
    else if (m.t === 'bubble') {
      const b: Bubble = { id: ++this.#key, seat: m.seat as Seat, text: String(m.text), note: m.note === true };
      if (!b.note) this.#misses = [...this.#misses, { by: b.seat, text: b.text }];
      this.bubbles = [...this.bubbles.slice(-4), b];
      setTimeout(() => (this.bubbles = this.bubbles.filter((x) => x !== b)), 3000);
      sounds.wrong();
    } else if (m.t === 'stamp') {
      const stamp = { key: ++this.#key, seat: m.seat as Seat, id: String(m.id) };
      this.stamps = [...this.stamps, stamp].slice(-MAX_STAMPS);
      setTimeout(() => (this.stamps = this.stamps.filter((s) => s !== stamp)), STAMP_MS);
    } else if (m.t === 'close') {
      this.close = true;
      setTimeout(() => (this.close = false), 1500);
      sounds.close();
    }
  }

  ink(i: Ink) {
    this.strokes = apply(this.strokes, i);
  }

  #show(next: View) {
    const prev = this.view;
    if (prev && next.turn !== prev.turn) {
      this.strokes = [];
      this.typing = {};
      this.#misses = [];
      sounds.turn();
    }
    if (prev?.phase === 'draw' && next.phase === 'reveal')
      this.gallery = [
        ...this.gallery,
        { word: next.word ?? '', by: next.drawer, strokes: this.strokes, misses: this.#misses }
      ];
    if (next.phase === 'draw' && next.left <= TICK_FROM && next.left > 0 && next.left !== prev?.left)
      sounds.tick(next.left <= HIGH_FROM);
    if (prev && next.solved.length > prev.solved.length) sounds.right();
    if (prev && next.buzzer !== null && next.buzzer !== prev.buzzer) sounds.buzz();
    this.view = next;
    this.screen = next.phase === 'done' ? 'result' : 'play';
  }
}
