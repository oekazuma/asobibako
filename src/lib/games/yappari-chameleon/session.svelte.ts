import { SvelteMap } from 'svelte/reactivity';
import * as THREE from 'three';
import type { Message } from '$lib/net/link';
import type { Party, Pipe, Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from './doll';
import type { DollRig } from './doll3d';
import { Effects } from './effects';
import { Glow, type Shine } from './glow';
import type { Host } from './host';
import { HunterView } from './hunter';
import { SPAWNS } from './mansion/layout';
import { Markers } from './markers';
import { Match } from './match.svelte';
import { floorBelow } from './move';
import { CHAMELEON_VERSION, dabMessages, DabOutbox, SEND_MS, splice, unpackDabs, type Me } from './net';
import type { Dab } from './paint';
import type { Play } from './play.svelte';
import { AIM, poseById, STAND } from './poses';
import { COOLDOWN, TOOT_GAP, type Settings, type View } from './referee';
import { HEAD_Y, paintColors, Remote, type Show } from './remote';
import { capsules, fire, placement, type Target } from './shots';
import { sounds } from './sounds';

/** 頭の上の名前の札（ロビーと答え合わせ） */
export interface Plate {
  seat: Seat;
  x: number;
  y: number;
  /** 答え合わせで受けたええやんの数 */
  likes: number;
}

/**
 * つないでから Session ができるまでに届いた知らせ。親は迎えてすぐ全員の体と塗りを送るが、3D を作るあいだはまだ聞く口が無いので、
 * つないだときからためておき、Session が受け継ぐ
 */
export interface Inbox {
  messages: Message[];
  stop: () => void;
}

/** 撃たれた人の破片が消えるまで。増え鬼では、そのあとハンターになる */
export const SHATTER_SECS = 1.5;

/**
 * つないで遊ぶ 1 台ぶん。親から届いた試合の様子で自分の役（隠れる・ハンター・観戦）を切り替え、
 * 自分の動きと塗りを送り、ほかの人の体・弾・しぶき・口笛を出す
 */
export class Session {
  readonly party: Party;
  readonly play: Play;
  readonly match: Match;
  readonly host: Host | null;
  /** 次を撃てるまでの残り秒 */
  cool = $state(0);
  /** 次の口笛を吹けるまでの残り秒 */
  tootWait = $state(0);
  /** 観戦で見ている人。null はフリーカメラ */
  watching = $state<Seat | null>(null);
  plates = $state.raw<Plate[]>([]);
  /** 親とこのゲームの版がちがった。抜けるのは画面側（親は子の回線を閉じられない） */
  mismatch = $state(false);
  readonly #makeRig: () => DollRig;
  readonly #remotes = new SvelteMap<Seat, Remote>();
  readonly #fx: Effects;
  readonly #gun: HunterView;
  readonly #glow: Glow;
  readonly #marks: Markers;
  // PaintLog.low は送る口が 1 つの前提なので、play.log を送る DabOutbox はここだけに置く
  readonly #out = new DabOutbox();
  /** 見つかったときの体（答え合わせで、その場に戻して光らせる） */
  readonly #found = new SvelteMap<Seat, Me>();
  /** 増え鬼でハンターになった人の、答え合わせで撃たれた場所に置く 2 つめの体（今のハンターの体は銃を持って別に動く） */
  readonly #pins = new SvelteMap<Seat, Remote>();
  /** 見つかった人の、見つかったときの塗り。増え鬼でハンターになると列が白に戻るので、答え合わせの撃たれた場所の体はこれで作る */
  readonly #snaps = new SvelteMap<Seat, Dab[]>();
  /** 今の小物の置き方の種。最初の様子で必ず当てるよう、まだ当てていないあいだは undefined */
  #seed: number | null | undefined = undefined;
  /** ダブルの残した体（席 → 隠れタイムの終わりの体） */
  readonly #lefts = new SvelteMap<Seat, Me>();
  /** 砕けて見えない残り秒 */
  readonly #shatter = new SvelteMap<Seat, number>();
  /** この答え合わせでええやんを送った。親の数が届く前に 2 回押しても、2 つめを送らない */
  #liked = false;
  #sent = -Infinity;
  /** 親から受け取った自分の体（戻った子は、その場から続ける） */
  #own: Me | null = null;
  readonly #stop: () => void;

  constructor(party: Party, play: Play, makeRig: () => DollRig, host: Host | null = null, inbox?: Inbox) {
    this.party = party;
    this.play = play;
    this.host = host;
    this.#makeRig = makeRig;
    this.match = new Match(() => party.me);
    const w = play.world;
    this.#fx = new Effects(w.scene);
    this.#gun = new HunterView(w);
    this.#glow = new Glow(w.rig);
    this.#marks = new Markers(w.scene);
    // ためていた口を外して、ためた知らせを順に入れてから聞き始める（間に知らせは割り込まない）
    inbox?.stop();
    this.#stop = party.onTell((m) => this.#receive(m));
    for (const m of inbox?.messages ?? []) this.#receive(m);
    // 親は自分の画面へも、子と同じ手順で全員の体と今の様子を送る。子は親が知らせを受け始める合図を、つなぐたびに送る
    if (host) host.welcome(party.me);
    else party.act({ t: 'hi', v: CHAMELEON_VERSION });
  }

  #remote(seat: Seat): Remote {
    let r = this.#remotes.get(seat);
    if (!r) this.#remotes.set(seat, (r = new Remote(this.#makeRig(), this.play.world.scene)));
    return r;
  }

  #receive(m: Message) {
    const seat = m.seat as Seat;
    const mine = seat === this.match.me;
    if (m.t === 'phase') this.#phase(m.view as View);
    else if (m.t === 'me') {
      if (!mine) this.#remote(seat).push(m as unknown as Me, performance.now());
      else if (!this.match.synced) this.#ownBody(m as unknown as Me);
    } else if (m.t === 'dabs') {
      if (!mine) this.#remote(seat).dabs(m.at as number, m.d as number[]);
      else if (!this.match.synced) this.#ownPaint(m.at as number, m.d as number[]);
    } else if (m.t === 'found') this.#onFound(seat, m.by as Seat, m.body as Me | undefined, m.quiet === true);
    else if (m.t === 'splat') this.#onSplat(m);
    else if (m.t === 'left') this.#onLeft(seat, m.body as Me);
    else if (m.t === 'leftDabs') this.#pins.get(seat)?.dabs(m.at as number, m.d as number[]);
    else if (m.t === 'toot') this.#onToot(seat, m.at as V3);
    else if (m.t === 'chameleon-mismatch') this.mismatch = true;
  }

  /** 体を me の場所・向き・張り付き・ポーズに置く。銃を構えたポーズは人形にはとらせない */
  #setBody(me: Me) {
    this.play.placeAt(me.pos, me.yaw);
    this.play.body.cling = me.cling;
    this.play.setPose(me.pose === AIM.id ? STAND.id : me.pose);
  }

  /** 戻った子が、親に残っていた自分の体を受け取る */
  #ownBody(me: Me) {
    this.#own = me;
    this.#setBody(me);
  }

  #ownPaint(at: number, d: number[]) {
    if (splice(this.play.log.dabs, at, unpackDabs(d)) === null) return;
    this.play.rebuildPaint();
    this.#out.adopt(this.play.log);
  }

  #phase(v: View) {
    const first = !this.match.synced;
    const before = this.match.phase;
    // 戻った子と途中で来た子は最初の様子で種を受けるので、フェーズの変わり目だけでなく、届くたびに見る
    if (v.seed !== this.#seed) {
      this.#seed = v.seed;
      this.play.world.arrange(v.seed);
    }
    this.match.receive(v);
    if (first) {
      if (!this.#own) this.#place();
      // 戻った子には親に残っていた探す前の塗りが届くことがあるが、ダブルの探す人は白い体なので消す（残した体は left で写してある）
      if (this.match.double && (v.phase === 'search' || v.phase === 'reveal')) this.#whiten();
      this.#fit(this.#own);
      if (v.phase === 'reveal') this.#reveal();
    } else if (before !== v.phase) this.#enter();
  }

  #enter() {
    const p = this.match.phase;
    if (p === 'reveal') this.#liked = false;
    if (p === 'lobby' || p === 'intro') {
      this.#reset();
      this.#place();
    }
    if (p === 'intro') sounds.intro();
    else sounds.phase();
    // ダブルの探す人は新しい白い体で入る（残した体は left の知らせで先に写してある）
    if (p === 'search' && this.match.double) this.#whiten();
    this.#fit(null);
    if (p === 'reveal') this.#reveal();
  }

  /** 試合の始めとロビーに戻ったとき。全員の塗りを白に戻し、しぶきを消す */
  #reset() {
    this.#whiten();
    for (const r of this.#remotes.values()) r.clearPaint();
    this.#fx.clear();
    this.#found.clear();
    this.#snaps.clear();
    this.#shatter.clear();
    for (const r of this.#pins.values()) r.dispose();
    this.#pins.clear();
    this.#lefts.clear();
    this.watching = null;
    this.play.unhunt();
    this.play.setPose(STAND.id);
  }

  /** 自分の塗りを白に戻す */
  #whiten() {
    // 描きかけの筆を先に切る。白に戻したあとで取り消しや続きの吹き付けが届くと、消した列が食い違う
    this.play.interrupt();
    this.play.log.clear();
    this.play.rebuildPaint();
    this.play.canUndo = false;
  }

  /** 体を始める場所へ移す。ロビーはロビーの部屋、待っているハンターは控室、ほかは大広間 */
  #place() {
    const p = this.match.phase;
    const room = this.match.role === 'hunter' && (p === 'intro' || p === 'hide');
    this.play.placeAt(SPAWNS[p === 'lobby' ? 'lobby' : room ? 'room' : 'hall'][this.match.me]);
    // 始める場所はどれも北（+z）を向いている。ロビーなら台、大広間なら屋敷の奥が見える
    this.play.camYaw = 0;
  }

  /** 試合の様子に合わせて、ハンター（一人称と銃）か観戦に切り替える。own は戻った子が親から受け取った自分の体 */
  #fit(own: Me | null) {
    const m = this.match;
    const armed = m.role === 'hunter' && (m.phase === 'search' || m.phase === 'reveal');
    if (armed && this.play.role !== 'hunter' && !this.#shatter.has(m.me)) {
      // 続きから始めるのは、切れる前もハンターとして歩いていた体だけ。隠れタイムに切れた子の体は控室か、ダブルなら
      // 隠れ場所（天井に張り付いていれば天井の面）なので、入口から探す
      const hunting = own && own.cling === null && (own.pose === AIM.id || own.crouch);
      const [x, y, z] = hunting ? own.pos : SPAWNS.entrance[m.me];
      this.play.hunt([x, floorBelow(this.play.world.level, x, z, y), z], hunting ? own.yaw : 0);
    } else if (!armed && m.phase !== 'lobby' && m.watching() && this.play.role !== 'watch') this.#watch();
  }

  #reveal() {
    const f = this.#found.get(this.match.me);
    // 増え鬼でハンターになった（なる）自分は撃ちに回っているので、撃たれた場所へは戻さない
    if (f && !this.#infected(this.match.me)) this.#setBody(f);
    if (this.play.role === 'watch') this.free();
  }

  #onFound(seat: Seat, by: Seat, body: Me | undefined, quiet: boolean) {
    if (this.match.double) {
      // 見つけた体はその人の画面からだけ消えるので、ほかの人の画面では何も起きない
      const pin = this.#pins.get(seat);
      if (by !== this.match.me || quiet || !pin) return;
      const at = pin.center();
      if (at) this.#fx.shatter(at, pin.colors());
      sounds.shatter();
      sounds.found();
      return;
    }
    if (body) this.#found.set(seat, body);
    const me = this.match.me;
    const live = seat === me ? null : this.#remote(seat);
    if (live) this.#snaps.set(seat, [...live.log]);
    if (quiet) return;
    const infect = this.match.view.settings.mode === 'infect';
    const at = live ? live.center() : this.play.world.dollCenter();
    if (at) this.#fx.shatter(at, live ? live.colors() : paintColors(this.play.log.dabs));
    sounds.shatter();
    if (by === me) sounds.found();
    this.#shatter.set(seat, SHATTER_SECS);
    if (seat !== me) return;
    // ペイントモードのあいだに見つかったら、ペイントモードを抜ける（本家 v1.4.0）
    if (this.play.mode === 'paint') this.play.togglePaint();
    this.play.interrupt();
    if (!infect) this.#watch();
  }

  /** 増え鬼で見つかった自分が、破片が消えたあと白い体のハンターになる */
  #turn() {
    const b = this.play.body;
    this.play.log.clear();
    this.play.rebuildPaint();
    // 張り付いたままの位置は壁や天井の面なので、真下の床に立たせる（天井の裏からそのまま立つと天井の上に出る）
    const [x, y, z] = b.pos;
    const feet = b.cling ? floorBelow(this.play.world.level, x, z, b.cling.kind === 'ceiling' ? y - HEIGHT : y) : y;
    this.play.hunt([x, feet, z], b.yaw);
  }

  #onSplat(m: Message) {
    if (m.by !== this.match.me) {
      this.#fx.trail(m.from as V3, m.ends as V3[]);
      sounds.shot();
    }
    for (const k of m.marks as { p: V3; n: V3 }[]) this.#fx.splat(k.p, k.n);
  }

  #onToot(seat: Seat, at: V3) {
    if (seat === this.match.me) return sounds.whistle([0, 0, -1]);
    this.#fx.note(at);
    // 聞く人のカメラから見た位置（右が +x、前が −z）
    const v = new THREE.Vector3(...at).applyMatrix4(this.play.world.camera.matrixWorldInverse);
    sounds.whistle([v.x, v.y, v.z]);
  }

  /** 観戦で見られる人。見えているかは、毎フレームの更新を待たず試合の様子から決める（見つかった直後に選べるように） */
  #watchable(): Seat[] {
    return [...this.#remotes]
      .filter(([s, r]) => r.shown && this.#show(s).visible)
      .map(([s]) => s)
      .sort((a, b) => a - b);
  }

  #watch() {
    this.play.spectate();
    this.watching = this.#watchable()[0] ?? null;
    if (this.watching === null) this.play.freeCam();
  }

  /** 観戦で、ほかの人を順に見る */
  next(dir: 1 | -1): void {
    const list = this.#watchable();
    if (!list.length) return this.free();
    const i = this.watching === null ? -1 : list.indexOf(this.watching);
    this.watching = list[(i + dir + list.length) % list.length];
  }

  /** 観戦のフリーカメラ */
  free(): void {
    this.watching = null;
    this.play.freeCam();
  }

  /** 答え合わせで、増え鬼で見つかってハンターになった人 */
  #infected(seat: Seat): boolean {
    return this.match.phase === 'reveal' && this.match.found(seat) && this.match.roleOf(seat) === 'hunter';
  }

  /** 撃たれた場所（増え鬼の答え合わせ）か残した場所（ダブル）に置く 2 つめの体。作るときの塗りを写して塗る */
  #pin(seat: Seat, paint: readonly Dab[]): Remote {
    let r = this.#pins.get(seat);
    if (!r) {
      r = new Remote(this.#makeRig(), this.play.world.scene);
      r.log.push(...paint);
      r.rig.paint.rebuild(r.log);
      this.#pins.set(seat, r);
    }
    return r;
  }

  /**
   * ダブルの残した体。親は探索の様子より先にこれを送るので、まだ白に戻っていない今の塗り（自分の列か、その人の Remote の列）を写す。
   * 写したあとに遅れて届く塗りは生きている体の列にだけ入り、残した体は変わらない。戻った子は塗りがもう白いので、あとから届く
   * leftDabs で塗り直す
   */
  #onLeft(seat: Seat, body: Me) {
    if (this.#pins.has(seat)) return;
    this.#lefts.set(seat, body);
    this.#pin(seat, [...(seat === this.match.me ? this.play.log.dabs : this.#remote(seat).log)]);
  }

  /** ダブルで、自分がもう見つけた体（探索のあいだは自分の画面から消す） */
  #caught(seat: Seat): boolean {
    return this.match.phase !== 'reveal' && (this.match.view.caught[this.match.me] ?? []).includes(seat);
  }

  /** ダブルの答え合わせで、誰かに見つかった体は青、まだの体は赤 */
  #leftShine(seat: Seat): Shine {
    if (this.match.phase !== 'reveal') return null;
    return Object.values(this.match.view.caught).some((got) => got?.includes(seat)) ? 'blue' : 'red';
  }

  /** その人の残した体（ダブル）か撃たれた場所の体（増え鬼）の塗りの数。headless の確かめが読む */
  pinPaint(seat: Seat): number | null {
    return this.#pins.get(seat)?.log.length ?? null;
  }

  #show(seat: Seat): Show {
    const m = this.match;
    const p = m.phase;
    const role = m.roleOf(seat);
    const found = m.found(seat);
    const infected = this.#infected(seat);
    const pin = p === 'reveal' && found && !infected ? (this.#found.get(seat) ?? null) : null;
    const away = !this.party.members.includes(seat) && (p === 'lobby' || role !== 'hider');
    const gone =
      away || role === 'out' || (found && !pin && (m.view.settings.mode === 'normal' || this.#shatter.has(seat)));
    return {
      pin,
      visible: !gone,
      armed: !pin && role === 'hunter' && (p === 'search' || p === 'reveal'),
      shine: infected ? null : this.#shine(seat)
    };
  }

  #shine(seat: Seat): Shine {
    if (this.match.phase !== 'reveal') return null;
    if (this.match.found(seat)) return 'blue';
    return this.match.roleOf(seat) === 'hider' ? 'red' : null;
  }

  frame(dt: number, now: number): void {
    const m = this.match;
    const me = m.me;
    const w = this.play.world;
    m.advance(dt);
    this.cool = Math.max(0, this.cool - dt);
    this.tootWait = Math.max(0, this.tootWait - dt);
    for (const [seat, left] of this.#shatter) {
      if (left > dt) {
        this.#shatter.set(seat, left - dt);
        continue;
      }
      this.#shatter.delete(seat);
      // 最後の隠れる人が撃たれると、すぐ答え合わせに入る
      if (seat === me && m.view.settings.mode === 'infect' && (m.phase === 'search' || m.phase === 'reveal'))
        this.#turn();
    }
    for (const [seat, r] of this.#remotes) {
      r.update(dt, now, this.#show(seat));
      const body = this.#infected(seat) ? this.#found.get(seat) : undefined;
      if (body)
        this.#pin(seat, this.#snaps.get(seat) ?? r.log).update(dt, now, {
          pin: body,
          visible: true,
          armed: false,
          shine: 'blue'
        });
    }
    for (const [seat, body] of this.#lefts)
      this.#pins
        .get(seat)
        ?.update(dt, now, { pin: body, visible: !this.#caught(seat), armed: false, shine: this.#leftShine(seat) });
    if (this.play.role === 'watch' && this.watching !== null && !this.#watchable().includes(this.watching))
      this.next(1);
    this.play.watch =
      this.play.role === 'watch' && this.watching !== null ? this.#remotes.get(this.watching)!.center() : null;
    const pinned = m.phase === 'reveal' && m.found() && this.#found.has(me) && !this.#infected(me);
    this.play.frozen = this.#shatter.has(me);
    const tps = this.play.role === 'hunter' && this.play.tps;
    w.rig.root.visible = ((this.play.role === 'hider' || tps) && !this.#shatter.has(me)) || pinned;
    this.#glow.set(w.rig.root.visible && !tps ? this.#shine(me) : null);
    w.podium(m.phase === 'lobby' && m.view.wishes.length > 0);
    this.#gun.visible = this.play.role === 'hunter' && !tps;
    w.holdGun(tps);
    this.#marks.set(this.#exposed(), dt);
    this.#fx.step(dt);
    this.#gun.step(dt);
    this.play.frame(dt, now);
    this.#plates();
    if (m.synced && now - this.#sent >= SEND_MS) {
      this.#sent = now;
      this.#post(now);
    }
  }

  /** 自分の動き。ハンターと観戦では人形は隠れていて動かないので、ハンターは目の位置を、観戦は何も送らない */
  #me(now: number): Me | null {
    const p = this.play;
    if (p.role === 'watch' || this.#shatter.has(this.match.me)) return null;
    // Play の frame がカメラを動かしたあとに送るので、そのコマのカメラの位置になる
    if (p.role === 'hunter')
      return {
        ms: now,
        pos: [...p.ghost.pos],
        yaw: p.eyeYaw,
        cling: null,
        pose: p.crouch ? 'crouch' : AIM.id,
        crouch: p.crouch,
        paint: false,
        look: [p.eyeYaw, p.eyePitch],
        eye: this.#aim().o
      };
    return {
      ms: now,
      pos: [...p.body.pos],
      yaw: p.body.yaw,
      cling: p.body.cling,
      pose: p.pose,
      crouch: false,
      paint: p.mode === 'paint',
      look: [p.camYaw, p.camPitch],
      eye: null
    };
  }

  #post(now: number) {
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
    const d = this.#out.take(this.play.log);
    if (d) for (const msg of dabMessages(this.match.me, d.at, d.d)) this.party.act(msg);
  }

  #plates() {
    const p = this.match.phase;
    if (p !== 'lobby' && p !== 'reveal') {
      if (this.plates.length) this.plates = [];
      return;
    }
    const w = this.play.world;
    const out: Plate[] = [];
    const add = (seat: Seat, head: V3 | null) => {
      const at = head && w.screen(head);
      if (at) out.push({ seat, ...at, likes: p === 'reveal' ? (this.match.view.likes[seat] ?? 0) : 0 });
    };
    // ダブルの答え合わせは、探す人の体ではなく残した体の上に札を出す
    if (p === 'reveal' && this.match.double) {
      for (const [seat, r] of this.#pins) if (r.rig.root.visible) add(seat, r.head());
      this.plates = out;
      return;
    }
    if (w.rig.root.visible) {
      const h = w.rig.root.localToWorld(new THREE.Vector3(0, HEAD_Y, 0));
      add(this.match.me, [h.x, h.y, h.z]);
    }
    for (const [seat, r] of this.#remotes) if (r.rig.root.visible) add(seat, r.head());
    this.plates = out;
  }

  /** 埋まりすぎて場所を知らされた人の頭。探索のあいだ、ハンターの画面だけに出す */
  #exposed(): V3[] {
    const m = this.match;
    if (this.play.role !== 'hunter' || m.phase !== 'search') return [];
    const out: V3[] = [];
    for (const seat of m.view.exposed) {
      if (seat === m.me) continue;
      const r = m.double ? (this.#caught(seat) ? undefined : this.#pins.get(seat)) : this.#remotes.get(seat);
      const head = r?.rig.root.visible ? r.head() : null;
      if (head) out.push(head);
    }
    return out;
  }

  /** 自分の体が埋まっている（隠れているあいだだけ警告を出す） */
  get buried(): boolean {
    return this.match.hiding && this.match.view.buried.includes(this.match.me);
  }

  /** ええやん。答え合わせのあいだ、自分以外の隠れた人に 1 試合 1 回 */
  like(seat: Seat): void {
    const m = this.match;
    if (
      this.#liked ||
      m.phase !== 'reveal' ||
      seat === m.me ||
      !m.view.hid.includes(seat) ||
      m.view.liked.includes(m.me)
    )
      return;
    this.#liked = true;
    this.party.act({ t: 'iine', to: seat });
  }

  /** もうええよ（隠れタイムと答え合わせ） */
  ready(): void {
    const m = this.match;
    if ((m.phase === 'hide' || m.phase === 'reveal') && !m.view.ready.includes(m.me)) this.party.act({ t: 'ready' });
  }

  /** 挑発できるか（ロビーでは全員、試合中は見つかっていない隠れる人） */
  get canTaunt(): boolean {
    return this.match.phase === 'lobby' || this.match.hiding;
  }

  taunt(): void {
    if (this.tootWait > 0 || !this.canTaunt) return;
    this.tootWait = TOOT_GAP;
    this.party.act({ t: 'taunt' });
  }

  toggleCrouch(): void {
    if (this.play.role === 'hunter') this.play.crouch = !this.play.crouch;
  }

  /**
   * 十字の線。三人称のカメラは家具の中に入ることがあり、そこから撃つと弾が家具の中で止まり、体の後ろの人にも当たるので、
   * 線の始まりを自分の体の深さ（右肩の上の点）まで十字に沿って進める。親は見落としポイントの視野もここから測る
   */
  #aim(): { o: V3; d: V3 } {
    const cam = this.play.world.camera;
    const v = cam.getWorldDirection(new THREE.Vector3());
    const d: V3 = [v.x, v.y, v.z];
    const c = cam.position;
    const h = this.play.tpsHead;
    const k = h ? Math.max(0, (h[0] - c.x) * d[0] + (h[1] - c.y) * d[1] + (h[2] - c.z) * d[2]) : 0;
    return { o: [c.x + d[0] * k, c.y + d[1] * k, c.z + d[2] * k], d };
  }

  /** 十字の向きへ撃つ。当たりは親が決め、ここでは銃口から筋を引く（from は筋の始点で、当たりの判定には使わない） */
  shoot(): void {
    if (this.cool > 0 || this.play.role !== 'hunter') return;
    this.cool = COOLDOWN;
    const { o, d } = this.#aim();
    const targets: Target[] = [];
    // 手元の筋の当たりも親と同じ的にする
    if (this.match.double) {
      for (const [seat, b] of this.#lefts)
        if (seat !== this.match.me && !this.#caught(seat))
          targets.push({ seat, caps: capsules(poseById(b.pose), placement(b)) });
    } else
      for (const [seat, r] of this.#remotes)
        if (r.shown && r.rig.root.visible && this.match.roleOf(seat) === 'hider')
          targets.push({ seat, caps: capsules(poseById(r.shown.pose), placement(r.shown)) });
    const rays = fire(this.play.world.level, o, d, targets);
    const from = this.play.tps ? this.play.world.gunMuzzle() : this.#gun.muzzle();
    this.#fx.trail(
      from,
      rays.map((r) => r.end)
    );
    this.#gun.fire();
    sounds.shot();
    this.party.act({ t: 'shot', o, d, from, ms: performance.now() });
  }

  start(settings: Settings): void {
    this.host?.start(settings);
  }

  /** 親だけ。2 人めと、切れた子を同じ番号で迎える */
  invite(link: Pipe): Promise<Seat | null | 'mismatch'> {
    return this.party.add(link);
  }

  /** WebGL のコンテキストが戻った。全員の塗りを列から作り直す */
  restore(): void {
    this.play.rebuildPaint();
    for (const r of this.#remotes.values()) r.rig.paint.rebuild(r.log);
    for (const r of this.#pins.values()) r.rig.paint.rebuild(r.log);
  }

  dispose(): void {
    this.#stop();
    for (const r of [...this.#remotes.values(), ...this.#pins.values()]) r.dispose();
    this.#fx.dispose();
    this.#glow.dispose();
    this.#marks.dispose();
    this.#gun.dispose();
  }
}
