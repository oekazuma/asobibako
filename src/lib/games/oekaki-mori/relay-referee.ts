import { animate } from '$lib/loop';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import type { Chars, Length } from './engine';
import { addInk, createRelay, finish, leave, next, pageOf, rejoin, taskOf, tick, type Relay } from './relay';
import type { Ink } from './strokes';
import { WORDS } from './words';

/**
 * 親の端末だけで動く。遊ぶ人の操作でリレーを進め、だんの頭に受け持ちを、変わったときに小さな見え方を、
 * ふりかえりでは 1 こまずつ絵を配る（絵をまとめると DataChannel の 1 回の上限を超えることがある）
 */
export class RelayReferee {
  readonly #party: Party;
  #state: Relay | null = null;
  #stop: (() => void)[] = [];
  /** 時間切れの当てるこまに使う、打ちかけの字 */
  #typed: Record<number, string> = {};
  #step = -1;
  #view = '';
  #page = '';

  constructor(party: Party) {
    this.#party = party;
  }

  start(length: Length, chars: Chars): void {
    this.#state = createRelay(this.#party.members, Math.random, WORDS, length, chars);
    this.#stop.push(
      this.#party.onAct((message, from) => this.#act(message, from)),
      animate((dt) => {
        if (!this.#state) return;
        tick(this.#state, dt, Math.random, WORDS, this.#typed);
        this.#push();
      })
    );
  }

  stop(): void {
    for (const stop of this.#stop.splice(0)) stop();
    this.#state = null;
  }

  #act(message: Message, from: Seat) {
    const s = this.#state;
    if (!s) return;
    if (message.t === 'ink') addInk(s, from, message.ink as Ink);
    else if (message.t === 'typing') this.#typed[from] = String(message.text);
    else if (message.t === 'relayDone') {
      // 二度押しや時間切れまぎわの「できた」が遅れて届いても、次のだんのこまを終わらせない
      if (Number(message.step) === s.step)
        finish(s, from, message.text === undefined ? undefined : String(message.text));
    } else if (message.t === 'relayNext' && from === 1) next(s);
    else if (message.t === 'leave') leave(s, from);
    else if (message.t === 'join') {
      rejoin(s, from);
      this.#catchUp(s, from);
    }
    this.#push();
  }

  /** 戻った子に、いまの見え方・受け持ち・めくり終えたこまを送り直す（その端末で保存する 1 枚に全部のリレーが入るように） */
  #catchUp(s: Relay, seat: Seat) {
    this.#party.tell(seat, { t: 'relayView', ...this.#viewOf(s) });
    if (s.phase === 'play') return this.#party.tell(seat, { t: 'relayTask', step: s.step, task: taskOf(s, seat) });
    const page = pageOf(s);
    if (!page) return;
    for (let c = 0; c <= page.chain; c++) {
      const chain = s.chains[c];
      const upto = c < page.chain ? chain.entries.length : page.index;
      for (let index = 0; index <= upto; index++) {
        const entry = index === 0 ? { kind: 'prompt', text: chain.start } : chain.entries[index - 1];
        this.#party.tell(seat, { t: 'relayPage', chain: c, index, entry, last: index === chain.entries.length });
      }
    }
  }

  #viewOf(s: Relay) {
    return { phase: s.phase, step: s.step, steps: s.steps, left: Math.max(0, Math.ceil(s.left)), done: [...s.done] };
  }

  #push() {
    const s = this.#state;
    if (!s) return;
    if (s.phase === 'play' && s.step !== this.#step) {
      this.#step = s.step;
      // 前のだんの打ちかけの字が、何も打たなかった人の答えにならないようにする
      this.#typed = {};
      for (const seat of this.#party.members)
        this.#party.tell(seat, { t: 'relayTask', step: s.step, task: taskOf(s, seat) });
    }
    const view = JSON.stringify(this.#viewOf(s));
    if (view !== this.#view) {
      this.#view = view;
      this.#party.tell('all', { t: 'relayView', ...this.#viewOf(s) });
    }
    const page = pageOf(s);
    const key = page ? `${page.chain}:${page.index}` : '';
    if (page && key !== this.#page) {
      this.#page = key;
      this.#party.tell('all', { t: 'relayPage', ...page });
    }
  }
}
