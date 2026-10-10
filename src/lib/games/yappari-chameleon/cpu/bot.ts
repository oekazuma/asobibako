import type { Message } from '$lib/net/link';
import { Party, type Pipe, type Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { SPAWNS } from '../mansion/layout';
import { Match } from '../match.svelte';
import { CHAMELEON_VERSION, SEND_MS, type Me } from '../net';
import type { Phase, View } from '../referee';

/** 答え合わせで結果を見る間（秒）。CPU が押さないと、1 人では「ロビーへ戻る」が答え合わせの終わりまで進まない */
export const REVEAL_READY = 5;

/**
 * CPU の子。手元の管で親の Party に子と同じ手順で入り（hello に cpu の印、席が決まったら hi）、届いた試合の様子で
 * 役とフェーズを持ち、止まっていても 50ms ごとに体を送る（親は止まっているかの判定と、撃った時刻へのさかのぼりに体の列を使う）。
 * 知らせは管の送った呼び出しの中で届くので、受けた中で送ると親の手続きの途中に割り込む。送るのは step の中だけ
 */
export class Bot {
  readonly party: Party;
  readonly match: Match;
  /** ほかの人の最後の体（親が中継する） */
  readonly bodies = new Map<Seat, Me>();
  /** 管が閉じた。Party が閉じた管の席を外す手続きより後に済むので、待てば顔ぶれから外れている */
  readonly gone: Promise<void>;
  #hi = false;
  #phase: Phase | null = null;
  /** 今のフェーズに入ってからの秒 */
  #since = 0;
  #pressed = false;
  #sent = -Infinity;
  #rest: { pos: V3; yaw: number } | null = null;

  constructor(pipe: Pipe) {
    this.party = Party.guest(pipe, { look: 'cpu' });
    this.match = new Match(
      () => this.party.me,
      () => this.party.looks
    );
    this.gone = pipe.closed;
    this.party.onTell((m) => this.#receive(m));
  }

  #receive(m: Message) {
    if (m.t === 'phase') this.match.receive(m.view as View);
    else if (m.t === 'me' && m.seat !== this.party.me) this.bodies.set(m.seat as Seat, m as unknown as Me);
    else if (m.t === 'chameleon-mismatch') this.party.close();
  }

  step(dt: number, now: number): void {
    // 席が届くまで Party.me は 1 のまま（CPU は席 2 か 3 に座る）
    if (this.party.lost || this.party.me === 1) return;
    if (!this.#hi) {
      this.#hi = true;
      this.party.act({ t: 'hi', v: CHAMELEON_VERSION });
    }
    if (!this.match.synced) return;
    if (this.match.phase !== this.#phase) this.#enter(this.match.phase);
    this.#since += dt;
    if (!this.#pressed && this.#wantReady()) {
      this.#pressed = true;
      this.party.act({ t: 'ready' });
    }
    if (now - this.#sent < SEND_MS) return;
    this.#sent = now;
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
  }

  #enter(p: Phase) {
    const m = this.match;
    this.#phase = p;
    this.#since = 0;
    this.#pressed = false;
    if (p === 'lobby') this.#rest = { pos: SPAWNS.lobby[m.me], yaw: 0 };
    // 人の子の Session と同じく、待っているハンターは控室、ほかは大広間で始める
    else if (p === 'intro') this.#rest = { pos: SPAWNS[m.role === 'hunter' ? 'room' : 'hall'][m.me], yaw: 0 };
  }

  #wantReady(): boolean {
    const m = this.match;
    if (m.view.ready.includes(m.me)) return false;
    if (m.phase === 'hide') return m.role === 'hunter';
    return m.phase === 'reveal' && this.#since >= REVEAL_READY;
  }

  #me(now: number): Me | null {
    const r = this.#rest;
    if (!r) return null;
    return {
      ms: now,
      pos: [...r.pos],
      yaw: r.yaw,
      cling: null,
      pose: 'stand',
      crouch: false,
      paint: false,
      look: [r.yaw, 0],
      eye: null
    };
  }

  close(): void {
    this.party.close();
  }
}
