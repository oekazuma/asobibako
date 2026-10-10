import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import { embedded } from './embed';
import { onPodium } from './mansion/lobby';
import type { Level } from './move';
import { CHAMELEON_VERSION, DAB_LEN, dabMessages, lerpMe, splice, type Me } from './net';
import { bodyPoints, rate, sight, still, STILL_MS } from './oversight';
import { poseById } from './poses';
import * as rules from './referee';
import { capsules, fire, placement, type Target } from './shots';

export interface Port {
  readonly members: Seat[];
  tell(to: Seat | 'all', message: Message): void;
  onAct(listener: (message: Message, from: Seat) => void): () => void;
}

/** 撃った時刻からさかのぼって体を調べる時刻（ミリ秒）。撃つ側と隠れる側の見え方のずれを小さくする */
export const REWIND = [0, 50, 100];
/** 試合の様子を変わらなくても送り直す間隔（秒）。見落としポイントもこの間隔で配る */
const BEAT = 1;
/** 小さな dt を足し重ねたずれで、間隔の手前に残らないようにする */
const EPS = 1e-6;
/**
 * step が進める 1 回の上限（秒）。親のアプリが裏に回ると描画のループごと止まるので、戻ったときの空白で試合を飛ばさず、
 * 止まっていたことにする
 */
const MAX_GAP = 1;
const SEATS: readonly unknown[] = [1, 2, 3];

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const v3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(num);
const isMe = (m: Message): boolean =>
  num(m.ms) &&
  v3(m.pos) &&
  num(m.yaw) &&
  typeof m.pose === 'string' &&
  Array.isArray(m.look) &&
  m.look.length === 2 &&
  (m.eye === undefined || m.eye === null || v3(m.eye));

/** いま隠れている体と、直前 STILL_MS のあいだ止まっていたか */
interface Hidden {
  seat: Seat;
  body: Me;
  still: boolean;
}

/**
 * 親の端末だけで動く審判。フェーズと時計を進め、全員の動きと吹き付けを中継し、撃った弾の当たりと、
 * 台の上の人・埋まり・見落としポイントを届いた体から決める。
 * 親自身の操作も act で同じ口から入るので（Party が手元で回す）、席 1 も子と同じに扱える
 */
export class Host {
  readonly match = rules.newMatch();
  readonly #port: Port;
  readonly #levelFor: (seed: number | null) => Level;
  #level: Level;
  #seed: number | null = null;
  readonly #now: () => number;
  readonly #rand: () => number;
  readonly #lines = new Map<Seat, Timeline<Me>>();
  /** 席ごとの吹き付けの列（数の列のまま）。戻った子へ全員の塗りを送り直すのに使う */
  readonly #logs = new Map<Seat, number[]>();
  readonly #greeted = new Set<Seat>([1]);
  /** 見つかったときの体。戻った子の答え合わせで、その場に戻して見せる */
  readonly #found = new Map<Seat, Me>();
  /** ダブルの残した体と、そのときの塗りの列。撃った弾の的にし、戻った子へ送り直す */
  readonly #left = new Map<Seat, { body: Me; log: number[] }>();
  #sent = '';
  #phase: rules.Phase = 'lobby';
  #beat = 0;
  #last: number | null = null;
  #stop: () => void;
  /** ロビーで台に乗った人をハンター希望にする。CPU と遊ぶではハンターを CPU の設定で決めるので切る */
  podium = true;

  constructor(
    port: Port,
    levelFor: (seed: number | null) => Level,
    now: () => number = () => performance.now(),
    rand: () => number = Math.random
  ) {
    this.#port = port;
    this.#levelFor = levelFor;
    this.#level = levelFor(null);
    this.#now = now;
    this.#rand = rand;
    this.#stop = port.onAct((m, from) => this.#act(m, from));
  }

  start(settings: rules.Settings, hunters?: Seat[]): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand, hunters);
    this.#push(true);
  }

  /**
   * 描画のループから毎コマ呼ぶ。描画の dt は 0.05 秒で切られるので、それで進めると親の重いコマ（GC・体の組み立て）のぶん
   * 試合の時計が遅れ、子の残り秒が戻り、撃つ間隔の判定もずれる。前に呼ばれてからの実時間で進める
   */
  step(): void {
    const now = this.#now();
    const gap = this.#last === null ? 0 : Math.min(MAX_GAP, (now - this.#last) / 1000);
    this.#last = now;
    if (gap > 0) this.tick(gap);
  }

  tick(dt: number): void {
    for (const seat of rules.tick(this.match, dt)) this.#toot(seat);
    this.#watch(dt);
    this.#beat += dt;
    this.#push(this.#beat >= BEAT - EPS);
  }

  stop(): void {
    this.#stop();
  }

  #act(m: Message, from: Seat) {
    if (m.t === 'hi') {
      if (m.v === CHAMELEON_VERSION) this.#greeted.add(from);
      else this.#port.tell(from, { t: 'chameleon-mismatch' });
      return;
    }
    if (m.t === 'join') {
      rules.join(this.match, from);
      this.welcome(from);
      return this.#push(true);
    }
    if (m.t === 'leave') {
      this.#greeted.delete(from);
      rules.leave(this.match, from, this.#port.members);
      return this.#push(true);
    }
    if (!this.#greeted.has(from)) return;
    if (m.t === 'me') {
      if (!isMe(m)) return;
      const me = { eye: null, ...m } as unknown as Me;
      this.#line(from).push(me.ms, this.#now(), me);
      this.#relay(from, m);
    } else if (m.t === 'dabs') {
      const { at, d } = m;
      if (!Number.isInteger(at) || (at as number) < 0 || !Array.isArray(d) || d.length % DAB_LEN || !d.every(num))
        return;
      const log = this.#logs.get(from) ?? [];
      this.#logs.set(from, log);
      if (splice(log, (at as number) * DAB_LEN, d) !== null) this.#relay(from, m);
    } else if (m.t === 'ready') {
      rules.ready(this.match, from, this.#port.members);
      this.#push(true);
    } else if (m.t === 'taunt') {
      if (rules.toot(this.match, from)) this.#toot(from);
    } else if (m.t === 'iine') {
      if (SEATS.includes(m.to) && rules.like(this.match, from, m.to as Seat)) this.#push(true);
    } else if (m.t === 'shot') this.#shot(m, from);
  }

  #line(seat: Seat): Timeline<Me> {
    let line = this.#lines.get(seat);
    if (!line) this.#lines.set(seat, (line = new Timeline<Me>()));
    return line;
  }

  #relay(from: Seat, m: Message) {
    for (const seat of this.#port.members) if (seat !== from) this.#port.tell(seat, { ...m, seat: from });
  }

  /**
   * 来た・戻った人へ、全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・今の試合の様子を送る。
   * 様子は最後に送り、受けた人はそれを受けてから自分の動きを送り始める（残っていた自分の体を上書きしない）
   */
  welcome(to: Seat): void {
    for (const [seat, line] of this.#lines) {
      const me = line.last();
      if (me) this.#port.tell(to, { t: 'me', ...me, seat });
    }
    for (const [seat, log] of this.#logs) for (const m of dabMessages(seat, 0, log)) this.#port.tell(to, m);
    for (const seat of this.match.found) {
      const body = this.#found.get(seat);
      if (body) this.#port.tell(to, { t: 'found', seat, by: 0, at: body.pos, body, quiet: true });
    }
    for (const [seat, left] of this.#left) {
      this.#port.tell(to, { t: 'left', seat, body: left.body });
      for (const m of dabMessages(seat, 0, left.log)) this.#port.tell(to, { ...m, t: 'leftDabs' });
    }
    this.#port.tell(to, { t: 'phase', view: rules.view(this.match) });
  }

  #toot(seat: Seat) {
    const me = this.#lines.get(seat)?.last();
    if (me) this.#port.tell('all', { t: 'toot', seat, at: me.pos });
  }

  /** 台の上の人（ロビー）・埋まり（隠れタイムと探索）・見落としポイント（探索）を、届いた体から決める */
  #watch(dt: number) {
    const m = this.match;
    if (m.phase === 'lobby') {
      for (const seat of this.#port.members) {
        const me = this.#lines.get(seat)?.last();
        rules.wish(m, seat, this.podium && !!me && onPodium(me));
      }
      return;
    }
    if (m.phase !== 'hide' && m.phase !== 'search') return;
    const bodies = this.#hidden();
    // 切れた人の体は止まったまま残るので、数え続けると知らせが出たままになる
    for (const b of bodies)
      rules.bury(m, b.seat, this.#port.members.includes(b.seat) && embedded(this.#level, b.body), dt);
    if (m.phase !== 'search') return;
    for (const hunter of rules.seatsOf(m, 'hunter')) {
      const eye = this.#port.members.includes(hunter) ? this.#lines.get(hunter)?.last() : undefined;
      if (!eye?.eye) continue;
      const viewer = { eye: eye.eye, look: eye.look };
      for (const b of bodies) {
        if (b.seat === hunter || !b.still || m.caught[hunter]?.includes(b.seat)) continue;
        const d = sight(this.#level, viewer, bodyPoints(b.body));
        if (d !== null) rules.overlooked(m, hunter, b.seat, rate(d) * dt);
      }
    }
  }

  /** いま隠れている体。ダブルの探索では残した体（動かない） */
  #hidden(): Hidden[] {
    const m = this.match;
    if (m.settings.mode === 'double' && m.phase === 'search')
      return [...this.#left].map(([seat, l]) => ({ seat, body: l.body, still: true }));
    const now = this.#now();
    const out: Hidden[] = [];
    for (const seat of rules.hiding(m)) {
      const line = this.#lines.get(seat);
      const a = line?.at(now, 0);
      const b = line?.at(now, STILL_MS);
      if (!a || !b) continue;
      const body = lerpMe(a.a, a.b, a.t);
      out.push({ seat, body, still: still(body.pos, lerpMe(b.a, b.b, b.t).pos) });
    }
    return out;
  }

  /**
   * 撃った弾の当たりを決める。通常と増え鬼は、撃った時刻（送った人の時計）を親の時計に直し、隠れる人の体をその時刻から
   * 0.1 秒前までさかのぼって調べる。的は隠れている人だけなので、撃った人やほかのハンター（見つかった人も）の体は弾を止めない。
   * ダブルの的は残した体で、撃った人の体と、撃った人がもう見つけた体は弾を止めない
   */
  #shot(m: Message, from: Seat) {
    const { o, d: dir, from: muzzle } = m;
    if (!v3(o) || !v3(dir) || !num(m.ms)) return;
    const len = Math.hypot(...dir);
    if (len < 1e-6 || !rules.shoot(this.match, from)) return;
    const d: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
    const double = this.match.settings.mode === 'double';
    const targets = double ? this.#leftTargets(from) : this.#liveTargets(m.ms + this.#line(from).offset());
    const rays = fire(this.#level, o, d, targets);
    this.#port.tell('all', {
      t: 'splat',
      by: from,
      // 筋は銃口から引く（当たりは十字の向き、つまりカメラの位置から見る）
      from: v3(muzzle) ? muzzle : o,
      ends: rays.map((r) => r.end),
      marks: rays.filter((r) => r.n).map((r) => ({ p: r.end, n: r.n }))
    });
    for (const r of rays) {
      const seat = r.seat as Seat | null;
      if (seat === null) continue;
      if (double) {
        if (rules.spot(this.match, from, seat)) this.#port.tell('all', { t: 'found', seat, by: from, at: r.end });
        continue;
      }
      if (!rules.hit(this.match, seat)) continue;
      const body = this.#lines.get(seat)?.last();
      if (body) this.#found.set(seat, body);
      this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
    }
    this.#push(true);
  }

  #liveTargets(at: number): Target[] {
    const targets: Target[] = [];
    for (const seat of rules.hiding(this.match)) {
      const line = this.#lines.get(seat);
      for (const back of REWIND) {
        const s = line?.at(at, back);
        if (!s) continue;
        const me = lerpMe(s.a, s.b, s.t);
        targets.push({ seat, caps: capsules(poseById(me.pose), placement(me)) });
      }
    }
    return targets;
  }

  #leftTargets(from: Seat): Target[] {
    const got = this.match.caught[from] ?? [];
    return [...this.#left]
      .filter(([seat]) => seat !== from && !got.includes(seat))
      .map(([seat, l]) => ({ seat, caps: capsules(poseById(l.body.pose), placement(l.body)) }));
  }

  /** フェーズに入ったときの手続き。様子より先に要るもの（ダブルの残した体）は、ここで配る */
  #entered(phase: rules.Phase) {
    const m = this.match;
    // 子は lobby と intro に入るとき塗りを全部消す。親も消さないと、いなかった席の古い列が戻ったとき送り直される
    if (phase === 'lobby' || phase === 'intro') {
      this.#logs.clear();
      this.#found.clear();
      this.#left.clear();
    }
    // 持ち主は探索の様子を受けると塗りを白に戻すので、残した体はその前に写させる
    if (phase === 'search' && m.settings.mode === 'double')
      for (const seat of m.hid) {
        const body = this.#lines.get(seat)?.last();
        if (!body) continue;
        this.#left.set(seat, { body, log: [...(this.#logs.get(seat) ?? [])] });
        this.#port.tell('all', { t: 'left', seat, body });
      }
    if (phase === 'reveal')
      for (const seat of m.hid) {
        const at = this.#left.get(seat)?.body ?? this.#found.get(seat) ?? this.#lines.get(seat)?.last();
        if (at) m.spots[seat] = at.pos;
      }
  }

  /**
   * 様子が変わったか、間隔が来たら全員へ配る。残り秒と見落としポイントは毎フレーム変わるので、変わったかどうかには数えず、
   * 間隔ごとの送り直しで配る
   */
  #push(force: boolean) {
    const phase = this.match.phase;
    if (phase !== this.#phase) this.#entered(phase);
    this.#phase = phase;
    const v = rules.view(this.match);
    if (v.seed !== this.#seed) {
      this.#seed = v.seed;
      this.#level = this.#levelFor(v.seed);
    }
    const key = JSON.stringify({ ...v, left: 0, overlook: null });
    if (!force && key === this.#sent) return;
    this.#sent = key;
    this.#beat = 0;
    this.#port.tell('all', { t: 'phase', view: v });
  }
}
