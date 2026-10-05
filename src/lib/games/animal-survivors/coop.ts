import type { Message } from '$lib/net/link';
import type { Party } from '$lib/net/party.svelte';
import type { AnimalId } from './animals';
import { apply, choices } from './choices';
import type { GearKey } from './gear';
import { applySnap, COOP_VERSION, lerpSnap, makeSnap, type Snap } from './snap';
import type { Ranks } from './upgrades';
import { addHero, BASE_SPEED, createWorld, type GameEvent, type World } from './world';

/** 親が様子を送る間（秒）と、子が自分の位置を送る間 */
const SNAP_EVERY = 0.05;
const MOVE_EVERY = 1 / 30;
/** 子は届いた様子をこれだけ遅らせて、前後の 2 つのあいだをつないで描く（届く間のむらで敵がカクつかないように） */
const DELAY_MS = 100;
const GUEST = 2;

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
export class CoopHost {
  ready = false;
  readonly #party: Party;
  readonly #w: World;
  #move: Move | null = null;
  #events: GameEvent[] = [];
  #acc = 0;

  constructor(party: Party, w: World) {
    this.#party = party;
    this.#w = w;
    party.onAct((m, from) => {
      if (m.t === 'hi') {
        if (m.v !== COOP_VERSION) return party.tell(from, { t: 'coop-mismatch' });
        if (this.ready) return;
        addHero(w, m.animal as AnimalId, m.ranks as Ranks, m.gear as GearKey[]);
        this.ready = true;
      } else if (m.t === 'move') this.#move = m as unknown as Move;
    });
  }

  /** 子に始めを知らせる。子は親と同じ種とステージで、描くための World を作る */
  start(seed = 1, stage = 'forest'): void {
    const h = this.#w.heroes[0];
    this.#party.tell(GUEST, { t: 'start', seed, stage, animal: h.animal.id });
  }

  /** step の前。子の位置を 2 匹めに書き、子の 3 択を選ぶ（試作では 1 つめの候補） */
  before(): void {
    const w = this.#w;
    const h = w.heroes[1];
    if (!h) return;
    if (this.#move && !h.down) Object.assign(h.player, this.#move);
    if (h.pending <= 0) return;
    w.cur = 1;
    try {
      while (h.pending > 0) {
        const c = choices(w)[0];
        if (c) apply(w, c);
        else h.pending = 0;
      }
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
    this.#party.tell(GUEST, { t: 'snap', s: makeSnap(this.#w, this.#events) } as Message);
    this.#events = [];
  }
}

/** 子の端末。自分の動物を動かして位置を送り、届いた様子を描くための World に写す */
export class CoopGuest {
  view: World | null = null;
  mismatch = false;
  readonly #party: Party;
  #snaps: { at: number; s: Snap }[] = [];
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
        this.#snaps = [];
      } else if (m.t === 'snap') {
        this.#snaps.push({ at: performance.now(), s: m.s as Snap });
        if (this.#snaps.length > 4) this.#snaps.shift();
      }
    });
    party.act({ t: 'hi', v: COOP_VERSION, ...me });
  }

  /** 自分の動物を自分の端末で動かす（親に動かしてもらうと Wi-Fi の遅れのぶんもたつく） */
  move(input: { x: number; y: number }, dt: number): void {
    const v = this.view;
    if (!v) return;
    const h = v.heroes[v.cur];
    if (h.down) return;
    const p = h.player;
    const speed = BASE_SPEED * h.stats.speed;
    p.moving = input.x !== 0 || input.y !== 0;
    p.x += input.x * speed * dt;
    p.y += input.y * speed * dt;
    if (p.moving) {
      const len = Math.hypot(input.x, input.y);
      p.aimX = input.x / len;
      p.aimY = input.y / len;
      if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
    }
    this.#sent += dt;
    if (this.#sent < MOVE_EVERY) return;
    this.#sent = 0;
    this.#party.act({ t: 'move', x: p.x, y: p.y, facing: p.facing, aimX: p.aimX, aimY: p.aimY, moving: p.moving });
  }

  /** 描く前に呼ぶ。届いた様子を DELAY_MS 遅らせ、前後の 2 つのあいだをつなぐ */
  frame(now: number): void {
    const v = this.view;
    const list = this.#snaps;
    if (!v || !list.length) return;
    const at = now - DELAY_MS;
    let k = list.length - 1;
    while (k > 0 && list[k - 1].at > at) k--;
    const b = list[k];
    const a = k > 0 ? list[k - 1] : null;
    if (a && b.at > a.at && at < b.at) lerpSnap(v, a.s, b.s, Math.max(0, (at - a.at) / (b.at - a.at)));
    else applySnap(v, b.s);
    // 出来事（倒した・拾った・レベルアップ）は、その様子を初めて見せたときに 1 回だけ渡す
    const seen = a && at < b.at ? a.s : b.s;
    v.events = seen === this.#shown ? [] : seen.events;
    this.#shown = seen;
  }
}
