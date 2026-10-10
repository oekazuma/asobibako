import type { Message } from '$lib/net/link';
import { Party, type Pipe, type Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from '../doll';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import { Match } from '../match.svelte';
import { floorBelow, type Level } from '../move';
import { CHAMELEON_VERSION, dabMessages, DabOutbox, SEND_MS, type Me } from '../net';
import { SHATTER_SECS, type Phase, type View } from '../referee';
import { HiderBrain } from './hider';
import { HunterBrain } from './hunter';
import { SKILLS, type Strength } from './levels';
import type { Ctx, Senses } from './senses';
import { pickSpot, type Spot } from './spots';

/** 答え合わせで結果を見る間（秒）。CPU が押さないと、1 人では「ロビーへ戻る」が答え合わせの終わりまで進まない */
export const REVEAL_READY = 5;

export interface BotOptions {
  strength: Strength;
  /** CPU の何人めか（0 か 1）。2 人のとき、別々の部屋から回り、別々の部屋に隠れる */
  index: number;
  rand?: () => number;
  /** 親の端末の 3D。3D ができるまでは null */
  senses?: () => Senses | null;
}

/** 増え鬼で見つかった隠れる CPU が、ハンターとして歩き出す所。張り付いていたら真下の床（天井の裏から立つと天井の上に出る） */
export function turnAt(spot: Spot, lv: Level): V3 {
  const [x, y, z] = spot.pos;
  if (!spot.cling) return [x, y, z];
  return [x, floorBelow(lv, x, z, spot.cling.kind === 'ceiling' ? y - HEIGHT : y), z];
}

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
  strength: Strength;
  hunter: HunterBrain | null = null;
  hider: HiderBrain | null = null;
  readonly #index: number;
  readonly #rand: () => number;
  readonly #senses: () => Senses | null;
  #hi = false;
  #phase: Phase | null = null;
  /** 今のフェーズに入ってからの秒 */
  #since = 0;
  #pressed = false;
  #sent = -Infinity;
  #rest: { pos: V3; yaw: number } | null = null;
  #out = new DabOutbox();
  /** 送り終えた吹き付けの数 */
  #flushed = 0;
  /** 増え鬼で見つかってからの秒 */
  #broken = 0;
  readonly #toots: V3[] = [];
  #level: Level | null = null;
  #seed: number | null | undefined = undefined;

  constructor(pipe: Pipe, o: BotOptions) {
    this.party = Party.guest(pipe, { look: 'cpu' });
    this.match = new Match(
      () => this.party.me,
      () => this.party.looks
    );
    this.gone = pipe.closed;
    this.strength = o.strength;
    this.#index = o.index;
    this.#rand = o.rand ?? Math.random;
    this.#senses = o.senses ?? (() => null);
    this.party.onTell((m) => this.#receive(m));
  }

  /** 今の試合の小物の置き方の当たり（親と同じく種から作る） */
  get level(): Level {
    const seed = this.match.view.seed;
    if (!this.#level || seed !== this.#seed) {
      this.#seed = seed;
      this.#level = levelOf(mansion(seed));
    }
    return this.#level;
  }

  #receive(m: Message) {
    if (m.t === 'phase') this.match.receive(m.view as View);
    else if (m.t === 'me' && m.seat !== this.party.me) this.bodies.set(m.seat as Seat, m as unknown as Me);
    else if (m.t === 'toot' && m.seat !== this.party.me) this.#toots.push(m.at as V3);
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
    const m = this.match;
    if (m.phase !== this.#phase) this.#enter(m.phase);
    this.#since += dt;
    this.#turn(dt);
    const ctx: Ctx = {
      me: m.me,
      view: m.view,
      level: this.level,
      bodies: this.bodies,
      senses: this.#senses(),
      now,
      act: (x) => this.party.act(x)
    };
    for (const at of this.#toots.splice(0)) this.hunter?.heard(at);
    this.hunter?.step(ctx, dt);
    this.hider?.step(ctx, dt);
    if (now - this.#sent >= SEND_MS) {
      this.#sent = now;
      this.#post(now);
    }
    if (!this.#pressed && this.#wantReady()) {
      this.#pressed = true;
      this.party.act({ t: 'ready' });
    }
  }

  #enter(p: Phase) {
    const m = this.match;
    this.#phase = p;
    this.#since = 0;
    this.#pressed = false;
    if (p === 'lobby' || p === 'intro') {
      this.hunter = this.hider = null;
      this.#broken = 0;
      // 人の子の Session と同じく、待っているハンターは控室、ほかは大広間で始める
      const where = p === 'lobby' ? 'lobby' : m.role === 'hunter' ? 'room' : 'hall';
      this.#rest = { pos: SPAWNS[where][m.me], yaw: 0 };
    } else if (p === 'hide' && m.role === 'hider') {
      const skill = SKILLS[this.strength];
      this.hider = new HiderBrain(
        pickSpot(m.view.seed ?? 1, this.#index, skill.tiers, this.#rand),
        skill,
        this.#rand,
        this.#index
      );
      this.#out = new DabOutbox();
      this.#flushed = 0;
    } else if (p === 'search' && m.role === 'hunter' && !m.found() && !this.hunter) {
      // 増え鬼で、探索に入ったコマのうちに見つかった隠れる CPU は、入口からではなく #turn で隠れていた場所から探す
      const [x, y, z] = SPAWNS.entrance[m.me];
      this.hunter = new HunterBrain(
        [x, floorBelow(this.level, x, z, y), z],
        0,
        SKILLS[this.strength],
        this.#index,
        this.#rand
      );
    }
  }

  /** 増え鬼で見つかったら、人の子と同じく破片が消える間をおいて、隠れていた場所から探し始める */
  #turn(dt: number) {
    const m = this.match;
    if (!this.hider || !m.found() || m.view.settings.mode !== 'infect' || m.role !== 'hunter') return;
    if ((this.#broken += dt) < SHATTER_SECS) return;
    const spot = this.hider.spot;
    this.hunter = new HunterBrain(turnAt(spot, this.level), spot.yaw, SKILLS[this.strength], this.#index, this.#rand);
    // 人の子と同じく白い体のハンターになる。列を空にしたことを送らないと、ほかの端末の体に塗りが残る
    this.hider.log.clear();
    const d = this.#out.take(this.hider.log);
    if (d) for (const msg of dabMessages(m.me, d.at, d.d)) this.party.act(msg);
    this.hider = null;
  }

  #post(now: number) {
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
    if (!this.hider) return;
    const d = this.#out.take(this.hider.log);
    if (d) for (const msg of dabMessages(this.match.me, d.at, d.d)) this.party.act(msg);
    this.#flushed = this.hider.log.dabs.length;
  }

  #wantReady(): boolean {
    const m = this.match;
    if (m.view.ready.includes(m.me)) return false;
    if (m.phase === 'hide')
      return m.role === 'hunter' || (!!this.hider?.done && this.#flushed === this.hider.log.dabs.length);
    // 見つかって観戦になった CPU も押す（押さないと、1 人では「ロビーへ戻る」が進まない）
    return m.phase === 'reveal' && this.#since >= REVEAL_READY;
  }

  #me(now: number): Me | null {
    // 見つかった体は、通常では観戦、増え鬼では破片が消えるまで送らない（人の子と同じ）
    if (this.match.found() && !this.hunter) return null;
    if (this.hunter) return this.hunter.me(now);
    if (this.hider) return this.hider.me(now);
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
