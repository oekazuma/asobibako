import type { Message } from '$lib/net/link';
import type { Party } from '$lib/net/party.svelte';
import type { AnimalId } from './animals';
import { openChest, type Reward } from './chest';
import { Prompts } from './prompts.svelte';
import { apply, choices, isFiller, type Choice } from './choices';
import type { GearKey } from './gear';
import { applySnap, COOP_VERSION, lerpSnap, makeSnap, type Snap } from './snap';
import { Timeline } from './timeline';
import type { Ranks } from './upgrades';
import { STORM_PUSH } from './storm';
import { addHero, BASE_SPEED, createWorld, SLOW, type GameEvent, type World } from './world';

/** 親が様子を送る間（秒）と、子が自分の位置を送る間 */
const SNAP_EVERY = 0.05;
const MOVE_EVERY = 1 / 30;
/**
 * 届いた様子と位置は、送った時刻でこれだけ遅らせて前後の 2 つのあいだをつなぐ（届く間のむらで相棒や敵がカクつかないように）。
 * 親の端末の子の位置は当たりにも使うので、短めにする
 */
const DELAY_MS = 100;
const MOVE_DELAY_MS = 60;
const GUEST = 2;
/** 子の 3 択への返事 */
const PICKS = new Set(['choose', 'reroll', 'skip', 'banish']);

export interface Me {
  animal: AnimalId;
  ranks: Ranks;
  gear: GearKey[];
}

interface Move {
  x: number;
  y: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  moving: boolean;
}

/** 親の端末。World を進め、子の位置を受け取り、様子を送る */
export type Pauser = 'host' | 'guest' | null;

export class CoopHost {
  ready = false;
  /** 止めた人。止めた人の「つづける」で再開する */
  paused: Pauser = null;
  readonly #party: Party;
  readonly #w: World;
  readonly #moves = new Timeline<Move>();
  #events: GameEvent[] = [];
  #acc = 0;
  /** 子へ送って返事を待っているもの（返事の前に同じ 3 択を送り直さない） */
  #asked: 'offer' | 'rewards' | null = null;
  #options: Choice[] = [];

  constructor(party: Party, w: World) {
    this.#party = party;
    this.#w = w;
    party.onAct((m, from) => {
      if (m.t === 'hi') {
        if (m.v !== COOP_VERSION) return party.tell(from, { t: 'coop-mismatch' });
        if (this.ready) return;
        addHero(w, m.animal as AnimalId, m.ranks as Ranks, m.gear as GearKey[]);
        this.ready = true;
      } else if (m.t === 'move') {
        if (!this.paused) this.#moves.push(m.ms as number, performance.now(), m as unknown as Move);
      } else if (m.t === 'pause') this.#pause('guest');
      else if (m.t === 'resume') this.paused === 'guest' && this.#resume();
      else this.#answer(m);
    });
  }

  pause(): void {
    this.#pause('host');
  }

  resume(): void {
    if (this.paused === 'host') this.#resume();
  }

  #pause(by: 'host' | 'guest'): void {
    if (this.paused) return;
    this.paused = by;
    this.#party.tell(GUEST, { t: 'pause', by });
  }

  /** 止まっていたあいだの子の位置は捨てる（再開した瞬間に、その位置へ飛ばないように） */
  #resume(): void {
    this.paused = null;
    this.#moves.clear();
    this.#party.tell(GUEST, { t: 'resume' });
  }

  /** 子の動物（cur = 1）に、子の端末で選んだものを当てる。3 択を引き直したら送り直す */
  #answer(m: Message): void {
    const w = this.#w;
    if (m.t === 'close') {
      if (this.#asked === 'rewards') this.#asked = null;
      return;
    }
    if (!w.heroes[1] || this.#asked !== 'offer' || !PICKS.has(m.t)) return;
    w.cur = 1;
    try {
      const c = this.#options[m.i as number];
      if (m.t === 'choose' && c) {
        apply(w, c);
        this.#asked = null;
      } else if (m.t === 'skip' && w.skips > 0) {
        w.skips -= 1;
        w.pending = Math.max(0, w.pending - 1);
        this.#asked = null;
      } else if (m.t === 'reroll' && w.rerolls > 0) {
        w.rerolls -= 1;
        this.#offer();
      } else if (m.t === 'banish' && c && w.banishes > 0 && !isFiller(c)) {
        w.banishes -= 1;
        w.banished.push(`${c.kind}:${c.id}`);
        this.#offer();
      } else this.#offer();
    } finally {
      w.cur = 0;
    }
  }

  /** 子の動物の 3 択を引いて送る（cur = 1 で呼ぶ） */
  #offer(): void {
    const w = this.#w;
    this.#options = choices(w);
    this.#asked = 'offer';
    const tools = { rerolls: w.rerolls, skips: w.skips, banishes: w.banishes };
    this.#party.tell(GUEST, { t: 'offer', options: this.#options, tools } as unknown as Message);
  }

  /** 子に始めを知らせる。子は親と同じ種とステージで、描くための World を作る */
  start(seed = 1, stage = 'forest'): void {
    const h = this.#w.heroes[0];
    this.#party.tell(GUEST, { t: 'start', seed, stage, animal: h.animal.id });
  }

  /** step の前。子の位置を 2 匹めに書き、子の動物の宝箱と 3 択を子へ送る（宝箱を先に開ける） */
  before(now = performance.now()): void {
    const w = this.#w;
    const h = w.heroes[1];
    if (!h) return;
    const m = this.#moves.at(now, MOVE_DELAY_MS);
    if (m && !h.down) {
      const p = h.player;
      p.x = m.a.x + (m.b.x - m.a.x) * m.t;
      p.y = m.a.y + (m.b.y - m.a.y) * m.t;
      ({ facing: p.facing, aimX: p.aimX, aimY: p.aimY, moving: p.moving } = m.b);
    }
    if (this.#asked || (h.chests <= 0 && h.pending <= 0)) return;
    w.cur = 1;
    try {
      if (h.chests > 0) {
        this.#asked = 'rewards';
        this.#party.tell(GUEST, { t: 'rewards', rewards: openChest(w) } as unknown as Message);
      } else this.#offer();
    } finally {
      w.cur = 0;
    }
  }

  /** step のあと。出来事をためて、決まった間ごとに様子を送る */
  after(dt: number): void {
    this.#events.push(...this.#w.events);
    this.#acc += dt;
    if (this.#acc < SNAP_EVERY || !this.ready) return;
    this.#acc = 0;
    this.#party.tell(GUEST, { t: 'snap', ms: performance.now(), s: makeSnap(this.#w, this.#events) } as Message);
    this.#events = [];
  }
}

/** 子の端末。自分の動物を動かして位置を送り、届いた様子を描くための World に写す */
export class CoopGuest {
  view: World | null = null;
  /** 子の端末の 3 択・宝箱・演出。選んだものは親へ送る */
  prompts: Prompts | null = null;
  paused: Pauser = null;
  mismatch = false;
  readonly #party: Party;
  readonly #snaps = new Timeline<Snap>();
  #shown: Snap | null = null;
  #sent = 0;

  constructor(party: Party, me: Me) {
    this.#party = party;
    party.onTell((m) => {
      if (m.t === 'coop-mismatch') this.mismatch = true;
      else if (m.t === 'start') {
        const view = createWorld(m.animal as AnimalId, m.seed as number, { w: 260, h: 380 }, {}, m.stage as string);
        addHero(view, me.animal, me.ranks, me.gear);
        view.cur = 1;
        this.view = view;
        this.prompts?.stop();
        this.prompts = new Prompts(view, undefined, { send: (msg) => party.act(msg) });
        this.#snaps.clear();
      } else if (m.t === 'pause') this.paused = m.by as Pauser;
      else if (m.t === 'resume') this.paused = null;
      else if (m.t === 'offer') this.prompts?.offer(m.options as Choice[], m.tools as Prompts['tools']);
      else if (m.t === 'rewards') this.prompts?.openRewards(m.rewards as Reward[]);
      else if (m.t === 'snap') {
        this.#snaps.push(m.ms as number, performance.now(), m.s as Snap);
      }
    });
    party.act({ t: 'hi', v: COOP_VERSION, ...me });
  }

  pause(): void {
    if (this.paused) return;
    this.paused = 'guest';
    this.#party.act({ t: 'pause' });
  }

  /** 止めたのが自分のときだけ、親に再開を頼む */
  resume(): void {
    if (this.paused === 'guest') this.#party.act({ t: 'resume' });
  }

  /** 自分の動物を自分の端末で動かす（親に動かしてもらうと Wi-Fi の遅れのぶんもたつく） */
  move(input: { x: number; y: number }, dt: number): void {
    const v = this.view;
    if (!v) return;
    const h = v.heroes[v.cur];
    if (h.down) return;
    const p = h.player;
    // 遅さ（糸の玉・冷たい息）と吹雪は親の step と同じ式で、遅さは親から届いた値で効かせる
    const speed = BASE_SPEED * h.stats.speed * (p.slow > 0 ? SLOW : 1);
    p.moving = input.x !== 0 || input.y !== 0;
    p.x += input.x * speed * dt;
    p.y += input.y * speed * dt;
    if (v.storm.left > 0 && v.freeze <= 0) {
      p.x += v.storm.wx * BASE_SPEED * STORM_PUSH * (1 - h.fx.wind) * dt;
      p.y += v.storm.wy * BASE_SPEED * STORM_PUSH * (1 - h.fx.wind) * dt;
    }
    if (p.moving) {
      const len = Math.hypot(input.x, input.y);
      p.aimX = input.x / len;
      p.aimY = input.y / len;
      if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
    }
    this.#sent += dt;
    if (this.#sent < MOVE_EVERY) return;
    this.#sent = 0;
    const move = { x: p.x, y: p.y, facing: p.facing, aimX: p.aimX, aimY: p.aimY, moving: p.moving };
    this.#party.act({ t: 'move', ms: performance.now(), ...move });
  }

  /** 描く前に呼ぶ。届いた様子を送った時刻で DELAY_MS 遅らせ、前後の 2 つのあいだをつなぐ */
  frame(now: number): void {
    const v = this.view;
    const r = this.#snaps.at(now, DELAY_MS);
    if (!v || !r) return;
    if (r.a !== r.b) lerpSnap(v, r.a, r.b, r.t);
    else applySnap(v, r.a);
    // 出来事（倒した・拾った・レベルアップ）は、その様子を初めて見せたときに 1 回だけ渡す
    v.events = r.a === this.#shown ? [] : r.a.events;
    this.#shown = r.a;
  }
}
