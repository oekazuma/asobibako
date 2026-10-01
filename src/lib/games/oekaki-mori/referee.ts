import { animate } from '$lib/loop';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import {
  answer,
  buzz,
  create,
  drawer,
  guess,
  leave,
  rejoin,
  start,
  tick,
  view,
  type Length,
  type Mode,
  type Quiz
} from './engine';
import { WORDS } from './words';

/**
 * 親の端末だけで動く。遊ぶ人の操作を受けてルールを進め、人ごとの見え方を配る。
 * 見え方は前に送ったものと変わったときだけ送る（残り秒が 1 秒変わるたびに 1 回ほど）
 */
export class Referee {
  readonly #party: Party;
  #state: Quiz | null = null;
  #sent = new Map<Seat, string>();
  #stop: (() => void)[] = [];

  constructor(party: Party) {
    this.#party = party;
  }

  start(mode: Mode, length: Length = 'normal'): void {
    this.#state = create(this.#party.members, Math.random, WORDS, mode, length);
    this.#stop.push(
      this.#party.onAct((message, from) => this.#act(message, from)),
      animate((dt) => {
        if (!this.#state) return;
        const late = tick(this.#state, dt);
        if (late !== null) this.#party.tell('all', { t: 'bubble', seat: late, text: 'じかんぎれ', note: true });
        this.#push();
      })
    );
    this.#push();
  }

  stop(): void {
    for (const stop of this.#stop.splice(0)) stop();
    this.#state = null;
  }

  #act(message: Message, from: Seat) {
    const s = this.#state;
    if (!s) return;
    if (message.t === 'start') start(s, from);
    else if (message.t === 'ink') {
      // 描く人の端末は自分で描いているので、ほかの人にだけ配る
      if (s.phase !== 'draw' || from !== drawer(s)) return;
      for (const seat of this.#party.members) if (seat !== from) this.#party.tell(seat, message);
    } else if (message.t === 'guess') {
      const text = String(message.text);
      const verdict = guess(s, from, text);
      if (verdict === 'wrong') this.#party.tell('all', { t: 'bubble', seat: from, text });
      else if (verdict === 'close') this.#party.tell(from, { t: 'close' });
    } else if (message.t === 'buzz') buzz(s, from);
    else if (message.t === 'answer') {
      const index = Number(message.index);
      const text = s.options[index];
      if (answer(s, from, index) === 'wrong') this.#party.tell('all', { t: 'bubble', seat: from, text });
    } else if (message.t === 'join') {
      rejoin(s, from);
      // 戻った子の画面は何も持っていないので、前に送った見え方と同じでも送り直す
      this.#sent.delete(from);
    } else if (message.t === 'typing') return this.#typing(s, from, String(message.text));
    else if (message.t === 'leave') {
      leave(s, from);
      // 打っている途中で切れた人の ● が、番の終わりまで残らないようにする
      for (const seat of this.#party.members)
        if (seat !== from) this.#party.tell(seat, { t: 'typing', seat: from, text: '' });
    }
    this.#push();
  }

  /**
   * 描く人には打っている字をそのまま、ほかの当てる人には字数だけ見せる（字が見えると答えがばれる）。
   * 空の字は、当てたあとや描く時間のあとでも配る。50 音盤は答えを送ってから空を知らせるので、捨てると ● が残る
   */
  #typing(s: Quiz, from: Seat, text: string) {
    if (s.mode !== 'egokoro' || from === drawer(s)) return;
    if (text && (s.phase !== 'draw' || s.solved.includes(from))) return;
    const hidden = '●'.repeat([...text].length);
    for (const seat of this.#party.members) {
      if (seat === from) continue;
      this.#party.tell(seat, { t: 'typing', seat: from, text: seat === drawer(s) ? text : hidden });
    }
  }

  #push() {
    const s = this.#state;
    if (!s) return;
    for (const seat of this.#party.members) {
      const next = view(s, seat);
      const key = JSON.stringify(next);
      if (this.#sent.get(seat) === key) continue;
      this.#sent.set(seat, key);
      this.#party.tell(seat, { t: 'view', view: next });
    }
  }
}
