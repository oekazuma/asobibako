import { animate } from '$lib/loop';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { create, drawer, guess, leave, pick, tick, view, type Egokoro } from './engine';

/**
 * 親の端末だけで動く。遊ぶ人の操作を受けてルールを進め、人ごとの見え方を配る。
 * 見え方は前に送ったものと変わったときだけ送る（残り秒が 1 秒変わるたびに 1 回ほど）
 */
export class Referee {
  readonly #party: Party;
  #state: Egokoro | null = null;
  #sent = new Map<Seat, string>();
  #stop: (() => void)[] = [];

  constructor(party: Party) {
    this.#party = party;
  }

  start(): void {
    this.#state = create(this.#party.members);
    this.#stop.push(
      this.#party.onAct((message, from) => this.#act(message, from)),
      animate((dt) => {
        if (!this.#state) return;
        tick(this.#state, dt);
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
    if (message.t === 'pick') pick(s, from, Number(message.index));
    else if (message.t === 'ink') {
      // 描く人の端末は自分で描いているので、ほかの人にだけ配る
      if (s.phase !== 'draw' || from !== drawer(s)) return;
      for (const seat of this.#party.members) if (seat !== from) this.#party.tell(seat, message);
    } else if (message.t === 'guess') {
      const text = String(message.text);
      const verdict = guess(s, from, text);
      if (verdict === 'wrong') this.#party.tell('all', { t: 'bubble', seat: from, text });
      else if (verdict === 'close') this.#party.tell(from, { t: 'close' });
    } else if (message.t === 'leave') leave(s, from);
    this.#push();
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
