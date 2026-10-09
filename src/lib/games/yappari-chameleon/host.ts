import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import { CHAMELEON_VERSION, DAB_LEN, dabMessages, lerpMe, splice, type Me } from './net';
import { poseById } from './poses';
import * as rules from './referee';
import { capsules, fire, placement, type Target } from './shots';

/** Party の親の口。テストでは手元の偽物に差し替える */
export interface Port {
  readonly members: Seat[];
  tell(to: Seat | 'all', message: Message): void;
  onAct(listener: (message: Message, from: Seat) => void): () => void;
}

/** 撃った時刻からさかのぼって体を調べる時刻（ミリ秒）。撃つ側と隠れる側の見え方のずれを小さくする */
export const REWIND = [0, 50, 100];
/** 試合の様子を変わらなくても送り直す間隔（秒） */
const BEAT = 1;
/** 小さな dt を足し重ねたずれで、間隔の手前に残らないようにする */
const EPS = 1e-6;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const v3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(num);
const isMe = (m: Message): boolean =>
  num(m.ms) && v3(m.pos) && num(m.yaw) && typeof m.pose === 'string' && Array.isArray(m.look) && m.look.length === 2;

/**
 * 親の端末だけで動く審判。フェーズと時計を進め、全員の動きと吹き付けを中継し、撃った弾の当たりを決める。
 * 親自身の操作も act で同じ口から入るので（Party が手元で回す）、席 1 も子と同じに扱える
 */
export class Host {
  readonly match = rules.newMatch();
  readonly #port: Port;
  readonly #level: Level;
  readonly #now: () => number;
  readonly #rand: () => number;
  readonly #lines = new Map<Seat, Timeline<Me>>();
  /** 席ごとの吹き付けの列（数の列のまま）。戻った子へ全員の塗りを送り直すのに使う */
  readonly #logs = new Map<Seat, number[]>();
  readonly #greeted = new Set<Seat>([1]);
  /** 見つかったときの体。戻った子の答え合わせで、その場に戻して見せる */
  readonly #found = new Map<Seat, Me>();
  #sent = '';
  #beat = 0;
  #stop: () => void;

  constructor(port: Port, level: Level, now: () => number = () => performance.now(), rand: () => number = Math.random) {
    this.#port = port;
    this.#level = level;
    this.#now = now;
    this.#rand = rand;
    this.#stop = port.onAct((m, from) => this.#act(m, from));
  }

  start(settings: rules.Settings): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand);
    this.#push(true);
  }

  tick(dt: number): void {
    for (const seat of rules.tick(this.match, dt)) this.#toot(seat);
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
      const me = m as unknown as Me;
      this.#line(from).push(me.ms, this.#now(), me);
      this.#relay(from, m);
    } else if (m.t === 'dabs') {
      const { at, d } = m;
      if (!Number.isInteger(at) || (at as number) < 0 || !Array.isArray(d) || d.length % DAB_LEN || !d.every(num))
        return;
      const log = this.#logs.get(from) ?? [];
      this.#logs.set(from, log);
      if (splice(log, (at as number) * DAB_LEN, d) !== null) this.#relay(from, m);
    } else if (m.t === 'wish') {
      if (this.match.phase === 'lobby') rules.wish(this.match, from, m.on === true);
      this.#push(true);
    } else if (m.t === 'ready') {
      rules.ready(this.match, from, this.#port.members);
      this.#push(true);
    } else if (m.t === 'taunt') {
      if (rules.toot(this.match, from)) this.#toot(from);
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
   * 来た・戻った人へ、全員の体・塗り・見つかったときの体・今の試合の様子を送る。
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
    this.#port.tell(to, { t: 'phase', view: rules.view(this.match) });
  }

  #toot(seat: Seat) {
    const me = this.#lines.get(seat)?.last();
    if (me) this.#port.tell('all', { t: 'toot', seat, at: me.pos });
  }

  /**
   * 撃った弾の当たりを決める。撃った時刻（送った人の時計）を親の時計に直し、隠れる人の体をその時刻から 0.1 秒前まで
   * さかのぼって調べる。的は隠れている人だけなので、撃った人やほかのハンター（見つかった人も）の体は弾を止めない
   */
  #shot(m: Message, from: Seat) {
    const { o, d: dir, from: muzzle } = m;
    if (!v3(o) || !v3(dir) || !num(m.ms)) return;
    const len = Math.hypot(...dir);
    if (len < 1e-6 || !rules.shoot(this.match, from)) return;
    const d: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
    const at = m.ms + this.#line(from).offset();
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
    const rays = fire(this.#level, o, d, targets);
    this.#port.tell('all', {
      t: 'splat',
      by: from,
      // 筋は銃口から引く（当たりは十字の向き、つまり目の位置から見る）
      from: v3(muzzle) ? muzzle : o,
      ends: rays.map((r) => r.end),
      marks: rays.filter((r) => r.n).map((r) => ({ p: r.end, n: r.n }))
    });
    for (const r of rays) {
      const seat = r.seat as Seat | null;
      if (seat === null || !rules.hit(this.match, seat)) continue;
      const body = this.#lines.get(seat)?.last();
      if (body) this.#found.set(seat, body);
      this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
    }
    this.#push(true);
  }

  /** 様子が変わったか、間隔が来たら全員へ配る。残り秒は毎フレーム変わるので、変わったかどうかには数えない */
  #push(force: boolean) {
    const v = rules.view(this.match);
    const key = JSON.stringify({ ...v, left: 0 });
    if (!force && key === this.#sent) return;
    this.#sent = key;
    this.#beat = 0;
    this.#port.tell('all', { t: 'phase', view: v });
  }
}
