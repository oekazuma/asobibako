import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Message } from './link';

export type Seat = 1 | 2 | 3;

/** Link と同じ口。テストでは手元でつないだ管に差し替える */
export interface Pipe {
  send(message: Message): void;
  on(listener: (message: Message) => void): () => void;
  readonly closed: Promise<void>;
  close(): void;
}

type ActListener = (message: Message, from: Seat) => void;
type TellListener = (message: Message) => void;

/**
 * 親を中心に 3 台までをつなぐ。子どうしはつながず、親が中継する。
 * 遊ぶ人の操作（act）は親のルールへ、ルールの知らせ（tell）は遊ぶ人の画面へ流れる。
 * 親の端末では両方を手元で回し、子から届いたものと同じ口で受けるので、ルールの処理は 1 本で済む
 */
export class Party {
  me = $state<Seat>(1);
  members = $state<Seat[]>([1]);
  /** 子で、親とのつながりが切れた */
  lost = $state(false);
  /** 親だけ。つながりが切れた子の番号。呼び直した子にはこの番号を先に渡し、点数と番を引き継がせる */
  away = $state<Seat[]>([]);
  readonly host: boolean;
  readonly #pipes = new SvelteMap<Seat, Pipe>();
  readonly #acts = new SvelteSet<ActListener>();
  readonly #tells = new SvelteSet<TellListener>();

  private constructor(host: boolean) {
    this.host = host;
  }

  static host(): Party {
    return new Party(true);
  }

  /** was は、つながりが切れる前の番号。親はその番号が空いていれば同じ番号で迎える */
  static guest(pipe: Pipe, was?: Seat): Party {
    const party = new Party(false);
    party.#pipes.set(1, pipe);
    pipe.on((message) => {
      if (message.t === 'seat') party.me = message.seat as Seat;
      else if (message.t === 'members') party.members = message.members as Seat[];
      else for (const listener of party.#tells) listener(message);
    });
    pipe.closed.then(() => (party.lost = true));
    pipe.send({ t: 'hello', was: was ?? null });
    return party;
  }

  /**
   * 親だけ。子の最初の知らせ（hello）を待って番号を決める。切れる前の番号が切れたまま空いていればその番号、
   * なければ切れた子の番号、それもなければ空いた番号で迎える。満員なら閉じて null
   */
  add(pipe: Pipe): Promise<Seat | null> {
    if (!this.host || this.#pipes.size >= 2) {
      pipe.close();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      let greeted = false;
      // Link はためていた知らせを on の中で渡すので、ここで外すと外す口がまだ無い。hello のあとは聞き流す
      pipe.on((message) => {
        if (greeted || message.t !== 'hello') return;
        greeted = true;
        resolve(this.#seat(pipe, message.was as Seat | null));
      });
      pipe.closed.then(() => resolve(null));
    });
  }

  #seat(pipe: Pipe, was: Seat | null): Seat | null {
    const free = (s: Seat) => !this.#pipes.has(s);
    const back = was !== null && this.away.includes(was) && free(was) ? was : undefined;
    const seat = back ?? this.away.find(free) ?? ([2, 3] as const).find((s) => free(s) && !this.away.includes(s));
    if (!seat) {
      pipe.close();
      return null;
    }
    this.away = this.away.filter((s) => s !== seat);
    this.#pipes.set(seat, pipe);
    pipe.on((message) => this.#act(message, seat));
    pipe.closed.then(() => this.#drop(seat, pipe));
    pipe.send({ t: 'seat', seat });
    this.#setMembers([...this.members, seat]);
    this.#act({ t: 'join' }, seat);
    return seat;
  }

  act(message: Message): void {
    if (this.host) this.#act(message, 1);
    else this.#pipes.get(1)?.send(message);
  }

  onAct(listener: ActListener): () => void {
    this.#acts.add(listener);
    return () => this.#acts.delete(listener);
  }

  /** 親だけ。1 番（親自身）への知らせは手元の画面へ回す */
  tell(to: Seat | 'all', message: Message): void {
    if (!this.host) return;
    for (const seat of to === 'all' ? this.members : [to]) {
      if (seat === 1) for (const listener of this.#tells) listener(message);
      else this.#pipes.get(seat)?.send(message);
    }
  }

  onTell(listener: TellListener): () => void {
    this.#tells.add(listener);
    return () => this.#tells.delete(listener);
  }

  close(): void {
    const pipes = [...this.#pipes.values()];
    this.#pipes.clear();
    // ページを閉じてから戻る（bfcache）と同じ Party が生き返るので、つながっていない人を顔ぶれに残さない
    this.members = [this.me];
    this.away = [];
    for (const pipe of pipes) pipe.close();
  }

  #act(message: Message, from: Seat) {
    for (const listener of this.#acts) listener(message, from);
  }

  #drop(seat: Seat, pipe: Pipe) {
    // 閉じたあとに同じ番号へ別の子が入っていれば、それは消さない
    if (this.#pipes.get(seat) !== pipe) return;
    this.#pipes.delete(seat);
    this.away = [...this.away, seat].sort((a, b) => a - b);
    this.#setMembers(this.members.filter((s) => s !== seat));
    this.#act({ t: 'leave' }, seat);
  }

  #setMembers(members: Seat[]) {
    this.members = [...members].sort((a, b) => a - b);
    for (const pipe of this.#pipes.values()) pipe.send({ t: 'members', members: this.members });
  }
}
