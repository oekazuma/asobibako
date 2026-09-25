import { remember } from '$lib/last-error';
import type { Activity, ActivityScene, Visit } from './activity';
import { command, createActor, RESTED, think, type Actor, type WorldView } from './behavior';
import { Bgm } from './bgm';
import { Bowls } from './bowls';
import type { Core, Touch } from './core';
import { speakAt, type Cry } from './cries';
import { daylight, greeting, now, phaseOf, type Phase, type Weather } from './daytime';
import { hasDecor, type RoomLook, type RoomPart, type RoomTheme } from './decor';
import { PetFx } from './effects';
import {
  SHOP,
  SLEEPY,
  addPhoto,
  adopt,
  buy,
  catchUp,
  count,
  day,
  itemName,
  kindOf,
  loadSave,
  mood,
  newSave,
  play,
  rest,
  tick,
  writePhotos,
  writeSave,
  type CounterId,
  type Pet,
  type Save,
  type ShopItem
} from './engine';
import { clampToFloor, LAYOUTS, ROOM, roomPerches, type Layout } from './layout';
import { FLEA_CLEAN } from './models';
import { Reactions } from './reactions';
import { Rubbing } from './rubbing';
import { sounds } from './sounds';
import { StampQueue } from './stamp-queue';
import { check } from './stamps';
import { Modes } from './modes';
import { Toys, WandHand } from './toys';
import { Training } from './training';
import type { AccessoryId, BaseScene, BreedId, FoodId, Scene, ToyId, TrickId } from './types';
import { WalkPlay } from './walk.svelte';
import { PetWorld } from './world3d';

export type Tool = 'hand' | 'brush' | 'toy';

/**
 * わんにゃんハウスの進行。画面（PetHouse.svelte）はこの状態を読み、ボタンと指をここへ渡す。
 * おもちゃ（toys.ts）・なでる（rubbing.ts）・芸（training.ts）・出来事の演出（reactions.ts）・お皿（bowls.ts）・
 * スタンプ（stamp-queue.ts）・遊びのモードの出入り（modes.ts）は core.ts の Core を受け取る部品で、ここは配線と画面から見える口を持つ。
 *
 * 画面側の配線:
 * - `new Session(gl, overlay, onhint)` を onMount で作り、`animate((dt) => session.frame(dt))`、unmount で `dispose()`
 * - 指は touch.ts の `createInput(() => session)` が返す BoardInput を `use:input.board={resize}` に付ける。
 *   resize では `session.resize(...input.px(1, 1))`（盤面の中のピクセル。overlay の canvas の大きさもここで合わせる）
 * - down / move / up の座標は盤面の中のピクセル、up の vx / vy はピクセル毎秒
 *
 * 取り決めに足したもの:
 * - `trickPending.until` は frame に渡した dt を積んだ時計（秒）。画面は null かどうかだけ見ればよい
 * - `setTool('toy', 'wand')` のように、toy を渡すとおもちゃも持ち替える
 * - 遊びのモード（コンテストなど）は `start(activity)`、ペットを連れないモードは `visit(mode)` で始める。口の使い方は activity.ts
 */
export class Session {
  save: Save = $state(loadSave() ?? newSave(Date.now()));
  scene: Scene = $state('room');
  tool: Tool = $state('hand');
  toy: ToyId = $state('ball');
  trickPending: { petId: string; trick: TrickId; until: number } | null = $state(null);
  toast = $state('');
  current: Pet | undefined = $derived(this.save.pets.find((p) => p.id === this.save.current));
  /**
   * いまの遊びのモード。画面はこれを見てモードの HUD を出し、ふだんのメニューを隠す。
   * モードは自分の $state の欄を持つので、深い proxy で包まずに同じものを保つ
   */
  activity: Activity | Visit | null = $state.raw(null);
  /** 場面を組み立てているあいだの行き先（「こうえんへ いくよ」）。画面はこのあいだ「いどうちゅう…」を重ねる */
  moving: string | null = $state(null);
  /**
   * 投げたおもちゃがまだ手元に戻っていない。ペットが front まで持ってくるか、床のおもちゃをタップして拾うまで次は投げられない。
   * 遊びのモードのあいだはモードが決めるので false
   */
  away = $state(false);
  /** おみせで試着しているアクセサリー。いまのペットに見た目だけ付け、save は変えない */
  trying: AccessoryId | null = $state(null);
  /** 画面が 3D をほとんど隠している（おみせなどのシート）。画面が教える */
  covered = false;
  /** いまの時間帯と、その日の天気（daytime.ts）。上の札のそばのアイコンが読む */
  sky: { phase: Phase; weather: Weather } = $state(((c) => ({ phase: phaseOf(c.hour), weather: c.weather }))(now()));

  readonly #world: PetWorld;
  readonly #overlay: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D | null;
  readonly #fx = new PetFx();
  readonly #bgm = new Bgm();
  readonly #onhint?: (t: string) => void;
  readonly #toys: Toys;
  readonly #wand: WandHand;
  readonly #training: Training;
  readonly #rubbing: Rubbing;
  readonly #reactions: Reactions;
  readonly #stamps: StampQueue;
  readonly #bowls: Bowls;
  readonly #modes: Modes;
  #actors: Actor[] = [];
  #layout: Layout = ROOM;
  #view: WorldView;
  #touches: Touch[] = [];
  /** 最後に指が触れた時刻と、描かずにためた時間。描く回数を減らして端末の発熱を抑える */
  #touched = 0;
  #unrendered = 0;
  #now = 0;
  #slow = 0;
  #w = 1;
  #h = 1;
  #hint = '';
  #toastUntil = 0;
  #dirty = false;
  #wrote = 0;
  /** 容量不足の知らせは 1 度の起動で 1 度だけ */
  #full = false;
  /**
   * 場面の組み立ては数百 ms 画面を止める。wait フレーム待って「いどうちゅう」を 1 度描かせてから run し、
   * シェーダーの準備が落ち着くまでさらに数フレーム出したままにする
   */
  #move: { run: (() => void) | null; wait: number } | null = null;
  /** むかえたばかりの子。次に部屋へ入ったとき、奥から歩いてこさせる */
  #arrival: string | null = null;
  #dayKey = '';
  #dayAt = 0;
  #night = 0;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, onhint?: (t: string) => void) {
    this.#onhint = onhint;
    this.#overlay = overlay;
    this.#ctx = overlay.getContext('2d');
    this.#world = new PetWorld(canvas);
    const core = this.#core();
    this.#toys = new Toys(core);
    this.#wand = new WandHand(core);
    this.#training = new Training(core);
    this.#rubbing = new Rubbing(core, this.#training);
    this.#reactions = new Reactions(core);
    this.#stamps = new StampQueue(core, () => !this.#moodText());
    this.#bowls = new Bowls(core);
    this.#modes = new Modes(core, {
      enter: (target) => this.#enter(target),
      go: (label, run) => this.#go(label, run),
      pause: () => this.#pause(),
      settle: () => {
        this.#fitToy();
        this.#write();
      },
      music: (track) => this.#bgm.play(track),
      found: (a) => {
        const p = this.#pet(a.petId);
        if (!p) return;
        play(p);
        this.#reactions.found(p, ...this.#above(a));
      },
      praise: (trick, amount) => {
        const pet = this.current;
        const a = this.#actor();
        if (pet && a) this.#training.praise(pet, a, trick, amount);
      }
    });
    this.#view = this.#emptyView('room');
    this.#world.trophies = this.save.contest;
    this.#world.room = this.save.room;
    const { allowance } = catchUp(this.save, Date.now());
    this.#checkDay();
    this.#enter('room');
    this.#fitToy();
    const back = check(this.save);
    if (back.length) this.#stamps.add(back.length > 1 ? back : back[0]);
    this.#dirty = true;
    // おこづかいの日はそちらを見せ、天気の一言はその日の次に開いたときに回す
    const today = day(Date.now());
    if (allowance) this.#say(`おこづかい ${allowance}コイン もらったよ！`);
    else if (this.save.greetedDay !== today) {
      this.save.greetedDay = today;
      this.#say(greeting(this.sky.phase, this.sky.weather));
    }
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  /** 部品に渡す口。view・actors・layout は場面に入るたびに作り直すので、読むたびに今のものを返す */
  #core(): Core {
    const now = () => this.#now;
    const view = () => this.#view;
    const layout = () => this.#layout;
    const actors = () => this.#actors;
    const touches = () => this.#touches;
    const w = () => this.#w;
    const h = () => this.#h;
    return {
      s: this,
      world: this.#world,
      fx: this.#fx,
      get view() {
        return view();
      },
      get layout() {
        return layout();
      },
      get actors() {
        return actors();
      },
      get touches() {
        return touches();
      },
      get now() {
        return now();
      },
      get w() {
        return w();
      },
      get h() {
        return h();
      },
      actor: (petId) => this.#actor(petId),
      pet: (petId) => this.#pet(petId),
      above: (a, y) => this.#above(a, y),
      purse: () => this.#purse(),
      say: (text, seconds) => this.#say(text, seconds),
      voice: (pet, cry) => this.#voice(pet, cry),
      count: (key, n) => this.#count(key, n),
      changed: () => void (this.#dirty = true),
      smooth: () => void (this.#touched = this.#now + 1)
    };
  }

  #onVisibility = () => {
    if (document.visibilityState === 'hidden') return this.#write(false);
    const { allowance } = catchUp(this.save, Date.now());
    this.#dirty = true;
    if (allowance) this.#say(`おこづかい ${allowance}コイン もらったよ！`);
  };

  #emptyView(scene: Scene): WorldView {
    const perches = scene === 'room' ? roomPerches(this.save.room) : undefined;
    return {
      scene,
      layout: this.#layout,
      bowls: this.#bowls.state,
      toy: null,
      wand: null,
      presents: [],
      perches,
      night: this.#night
    };
  }

  #enter(target: BaseScene | ActivityScene) {
    const scene = typeof target === 'string' ? target : target.id;
    this.#layout = typeof target === 'string' ? LAYOUTS[target] : target.layout;
    this.scene = scene;
    this.#world.setScene(target);
    this.#view = this.#emptyView(scene);
    this.away = false;
    this.#touches = [];
    this.#wand.on = false;
    this.#spawnActors();
    if (scene === 'park') for (let i = 0; i < 3; i++) this.#reactions.spawnPresent();
    if (scene === 'park') this.#count('walk');
    this.#music();
  }

  /** 夜の部屋と、窓の外が星空の部屋は夜の曲（同じ曲を静かにゆっくり）。雨の日の部屋は少しゆっくり、しっとり */
  #music() {
    const room = this.scene === 'room';
    const night = this.sky.phase === 'night' || this.save.room.view === 'castle';
    this.#bgm.play(room && night ? 'night' : room && this.sky.weather === 'rain' ? 'rain' : this.scene);
  }

  /** 時刻と天気を見て、変わっていたら 3D と眠さに映す。空の色は 3 分ごとに描き直す */
  #checkDay() {
    const { hour, weather } = now();
    const key = `${Math.round(hour * 20)}:${weather}`;
    if (key === this.#dayKey) return;
    this.#dayKey = key;
    const d = daylight(hour, weather);
    this.#world.setDaylight(d);
    this.#night = this.#view.night = d.night;
    if (d.phase === this.sky.phase && weather === this.sky.weather) return;
    this.sky = { phase: d.phase, weather };
    // 遊びのモードは自分の曲を流しているので替えない。部屋に戻ったときに合わせる
    if (!this.activity) this.#music();
  }

  /**
   * 部屋と公園には全員、遊びのモードの場面（道・おふろなど）にはモードが動かすいまのペットだけ。front のまわりに並べる。
   * 公園では、いまの子を front に、ほかの子を先に来て待っていたように少し奥へ置く
   */
  #spawnActors() {
    const { front } = this.#layout;
    const park = this.scene === 'park';
    const all = this.save.pets;
    const me = all.filter((p) => p.id === this.save.current);
    const pets = this.scene === 'room' ? all : park ? [...me, ...all.filter((p) => !me.includes(p))] : me;
    this.#actors = pets.map((p, i) =>
      p.id === this.#arrival && this.scene === 'room'
        ? this.#welcome(p)
        : createActor(p, { x: front.x + [0, -0.55, 0.55][i % 3], z: front.z - 0.25 - (i ? (park ? 1 : 0.3) : 0) })
    );
    this.#world.syncPets(this.save.pets);
  }

  #actor(petId = this.save.current) {
    return this.#actors.find((a) => a.petId === petId);
  }

  #pet(petId: string) {
    return this.save.pets.find((p) => p.id === petId);
  }

  /** ペットの頭の上あたりの画面の位置 */
  #above(a: Actor, y = 0.42): [number, number] {
    const [x, sy] = this.#world.project(a.x, a.y + y, a.z);
    return [x, sy];
  }

  /** コインが飛んでいく先。画面の上の札のお金のあたり */
  #purse(): [number, number] {
    return [this.#w * 0.72, 36];
  }

  #say(text: string, seconds = 3) {
    this.toast = text;
    this.#toastUntil = this.#now + seconds;
  }

  #voice(pet: Pet, cry: Cry = moodCry(pet)) {
    const a = this.#actor(pet.id);
    if (a) speakAt(this.#fx, pet.breed, cry, this.#above(a));
  }

  /** 押すかどうかは次の #write でまとめて確かめる */
  #count(key: CounterId, n = 1) {
    count(this.save, key, n);
    this.#dirty = true;
  }

  /**
   * 条件の多くはハート・芸・持ちものなど save から数えるので、書くたび（1 秒に 1 回まで）にまとめて確かめる。
   * 閉じる・隠れるときは押しても見せられないので確かめず、次に開いたときに押す
   */
  /** いまの記録をすぐ書く。固まるおそれのある操作（マイク）の前に呼ぶ */
  flush() {
    this.#write(false);
  }

  #write(stamp = true) {
    if (stamp) this.#stamps.add(...check(this.save));
    if (!writeSave($state.snapshot(this.save)) && !this.#full) {
      // 閉じると進みが戻ってしまうので、遊んでいるうちに大人が気づけるようにする
      this.#full = true;
      this.#say('きろくが いっぱいで のこせないよ。おうちの ひとに みせてね');
      remember('わんにゃんハウスの記録を保存できませんでした（容量）');
    }
    this.#dirty = false;
    this.#wrote = this.#now;
  }

  #fitToy() {
    const pet = this.current;
    if (!pet) return;
    const good: ToyId[] = kindOf(pet.breed) === 'dog' ? ['ball', 'frisbee'] : ['wand', 'mouse'];
    const own = this.save.toys;
    if (good.includes(this.toy) && own.includes(this.toy)) return;
    this.toy = good.find((t) => own.includes(t)) ?? own[0] ?? 'ball';
  }

  frame(dt: number): void {
    const m = this.#move;
    if (m && --m.wait <= 0) {
      const run = m.run;
      [m.run, m.wait] = [null, 3];
      if (run) run();
      else [this.#move, this.moving] = [null, null];
    }
    this.#now += dt;
    if ((this.#dayAt -= dt) <= 0) {
      this.#dayAt = 2;
      this.#checkDay();
    }
    const pets = this.save.pets;
    // save は深い $state なので、毎フレーム書くとペットの札が 60 回/秒描き直される。ゆっくり変わる値はまとめて進める
    this.#slow += dt;
    if (this.#slow >= 0.25) {
      const step = this.#slow;
      this.#slow = 0;
      tick(this.save, step);
      for (const a of this.#actors) {
        const pet = this.#pet(a.petId);
        if (!pet) continue;
        if (a.asleep || (a.perch && a.pose === 'down')) rest(pet, step, !a.asleep);
        if (this.scene === 'park' && a.v > 0.05) play(pet, step / 20);
      }
    }
    this.activity?.frame(dt);
    // frame の中で host.end() を呼んだモードには、もう出来事を渡さない
    const act = this.activity;
    if (!act?.drives) {
      this.#view.current = this.save.current;
      this.#wand.step(dt);
      this.#rubbing.tick(dt);
      for (const e of think(this.#actors, pets, this.#view, dt, Math.random))
        if (!act?.event?.(e)) this.#reactions.event(e);
    }
    this.#reactions.ambient(dt);
    this.#bgm.tick();
    if (!this.activity) this.#toys.tick(dt);
    const away = !this.activity && this.#toys.away();
    if (away !== this.away) this.away = away;

    if (this.trickPending && this.#now > this.trickPending.until) this.trickPending = null;
    if (this.toast && this.#now > this.#toastUntil) this.toast = '';
    this.#stamps.tick(dt);
    const hint =
      this.toast || (this.activity ? '' : this.trying ? `${this.current?.name}に にあうかな？` : this.#moodText());
    if (hint !== this.#hint) {
      this.#hint = hint;
      this.#onhint?.(hint);
    }
    if ((this.#dirty && this.#now - this.#wrote > 1) || this.#now - this.#wrote > 30) this.#write();

    this.#fx.step(dt);
    this.#unrendered += dt;
    // 少し早めに描いてよい幅を持たせる。ぴったりだと 60Hz の画面で 1 コマ待ちがちになり、狙いより遅くなる
    if (this.#unrendered < 1 / this.#fps() - 0.004) return;
    const step = this.#unrendered;
    this.#unrendered = 0;
    const cast = this.#modes.cast;
    const trying = this.trying;
    // おみせのシートが画面の下半分をふさぐので、試着のあいだは絵を上へずらしてペットを見せる
    this.#world.lift = trying ? 0.36 : 0;
    const shown = trying ? pets.map((p) => (p.id === this.save.current ? { ...p, accessory: trying } : p)) : pets;
    this.#world.syncPets(cast ? [...shown, ...cast.pets] : shown);
    this.#world.update(cast?.actors ?? this.#actors, this.#view, step, this.#now, this.save.current, this.tool);
    this.#world.render();
    const ctx = this.#ctx;
    if (!ctx) return;
    const dpr = this.#overlay.width / this.#w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);
    // モードの絵（リズムあそびのレーン）の上に、ハートやはじける光を重ねる
    this.activity?.draw?.(ctx);
    this.#fx.draw(ctx, this.#w, this.#h);
  }

  /**
   * 1 秒に描く回数。毛の殻・影・草を毎秒 60 回描き続けると、動きは足りていても端末が熱を持つ。
   * 指で遊んでいる・おもちゃが飛んでいるあいだだけ 60 にし、のんびりしているときは減らす
   */
  #fps(): number {
    if (this.activity?.smooth) return 60;
    const toy = this.#view.toy;
    if (this.#touches.length || this.#wand.on || (toy && !toy.still) || this.#now - this.#touched < 2) return 60;
    if (this.covered && !this.trying) return 15;
    if (this.#now - this.#touched > 60) return 20;
    return 30;
  }

  #moodText(): string {
    const pet = this.current;
    if (!pet) return '';
    const n = pet.name;
    if (this.#actor()?.asleep) return `${n}は ねています`;
    if (this.scene === 'park' && pet.stats.energy < 15) return 'つかれたみたい。おうちへ かえろう';
    switch (mood(pet)) {
      case 'hungry':
        return `${n}は おなかが すいてるみたい`;
      case 'thirsty':
        return `${n}は のどが かわいてるみたい`;
      case 'dirty':
        if (pet.stats.clean < FLEA_CLEAN) return `${n}が かゆそう。おふろに いれてあげよう`;
        return `${n}が よごれてるよ。ブラシで きれいに しよう`;
      case 'sleepy':
        return `${n}は ねむそう`;
      default:
        return !this.#rubbing.stroked && pet.love < 1 ? `${n}を ゆびで なでて あげよう` : '';
    }
  }

  // --- 指 ---

  down(id: number, px: number, py: number): void {
    this.#touched = this.#now;
    const act = this.activity;
    if (act && (act.down?.(id, px, py) || act.drives)) return;
    if (!this.current || !this.#actors.length) return;
    if (!act && this.#toys.pickUp(px, py)) return;
    const touch: Touch = {
      id,
      x: px,
      y: py,
      sx: px,
      sy: py,
      t0: this.#now,
      moved: 0,
      rub: 0,
      pet: null,
      part: null,
      stray: 0,
      mode: 'floor'
    };
    this.#touches.push(touch);
    if (this.tool === 'toy') {
      touch.mode = this.toy === 'wand' ? 'wand' : 'throw';
      if (touch.mode === 'wand') this.#wand.aim(px, py);
      return;
    }
    const hit = this.#world.pickPart(px, py);
    if (!hit) return;
    touch.mode = 'rub';
    touch.pet = hit.id;
    touch.part = hit.part;
    if (hit.id !== this.save.current) this.select(hit.id);
  }

  move(id: number, px: number, py: number): void {
    this.#touched = this.#now;
    if (this.activity?.move?.(id, px, py)) return;
    const touch = this.#touches.find((t) => t.id === id);
    if (!touch) return;
    const d = Math.hypot(px - touch.x, py - touch.y);
    touch.moved += d;
    touch.x = px;
    touch.y = py;
    if (touch.mode === 'wand') return this.#wand.aim(px, py);
    if (touch.mode === 'throw') return;
    this.#rubbing.move(touch, d);
  }

  up(id: number, px: number, py: number, vx: number, vy: number): void {
    if (this.activity?.up?.(id, px, py, vx, vy)) return;
    const touch = this.#touches.find((t) => t.id === id);
    this.#touches = this.#touches.filter((t) => t !== touch);
    if (!touch) return;
    if (touch.mode === 'rub') this.#world.setBrush(null);
    if (touch.mode === 'rub' && this.tool === 'hand' && touch.moved > 30) this.#count('stroke');
    if (touch.mode === 'wand') this.#wand.on = this.#touches.some((t) => t.mode === 'wand');
    if (touch.mode === 'throw') this.#toys.throw(touch, px, py, vx, vy);
    if (touch.mode === 'floor' && touch.moved < 16 && this.#now - touch.t0 < 0.6) this.#callTo(px, py);
  }

  #callTo(px: number, py: number) {
    const pet = this.current;
    const a = this.#actor();
    if (!pet || !a) return;
    const seat = this.#world.furniture(px, py);
    if (seat && this.#view.perches?.some((q) => q.id === seat.id)) {
      this.#fx.ripple(px, py);
      // ベッドは寝かせに行く場所。元気いっぱいの子は寝てもすぐ起きてしまうので、伏せて休むだけにする
      const sleepy = pet.stats.energy < RESTED;
      if (!a.carrying) {
        if (seat.id === 'sofa') this.#say(`${pet.name}、ソファに おいで`);
        else
          this.#say(sleepy ? `${pet.name}、ねんね しようね` : `${pet.name}は まだ ねむくないみたい。ひとやすみ しよう`);
      }
      const then = seat.id === 'bed' ? (sleepy ? 'sleep' : 'down') : undefined;
      return command(a, pet, { type: 'call', to: seat, perch: seat.id, then });
    }
    const p = this.#world.floor(px, py);
    if (!p) return;
    this.#fx.ripple(px, py);
    command(a, pet, { type: 'call', to: clampToFloor(this.#layout, p) });
  }

  resize(w: number, h: number): void {
    this.#w = w;
    this.#h = h;
    const dpr = devicePixelRatio || 1;
    this.#overlay.width = Math.round(w * dpr);
    this.#overlay.height = Math.round(h * dpr);
    this.#world.resize(w, h);
  }

  // --- 画面のボタン ---

  select(petId: string): void {
    if (this.activity || !this.#pet(petId) || this.save.current === petId) return;
    this.trying = null;
    this.save.current = petId;
    this.#dirty = true;
    this.#fitToy();
  }

  setTool(tool: Tool, toy?: ToyId): void {
    this.tool = tool;
    if (toy) this.toy = toy;
  }

  feed(food: FoodId): void {
    this.#bowls.feed(food);
  }

  water(): void {
    this.#bowls.water();
  }

  call(): void {
    const pet = this.current;
    const a = this.#actor();
    if (!pet || !a) return;
    this.#voice(pet, a.asleep ? 'yawn' : 'answer');
    command(a, pet, { type: 'call' });
  }

  trick(trick: TrickId): void {
    if (this.activity) return this.activity.trick?.(trick);
    this.#training.trick(trick);
  }

  /** いまのペットが寝ている。おさんぽ（モード）を始める前に画面が確かめる */
  get asleep(): boolean {
    return !!this.#actor()?.asleep;
  }

  /** 犬はリードで道をおさんぽして公園へ、猫はそのまま公園へ。公園からはおうちへ。つかれているときは goPark がことわる */
  walk(): void {
    const pet = this.current;
    if (this.scene !== 'room') return this.goHome();
    if (pet && kindOf(pet.breed) === 'dog' && pet.stats.energy >= SLEEPY && !this.asleep)
      return this.start(new WalkPlay(), 'おさんぽに いくよ');
    this.goPark();
  }

  goPark(): void {
    const pet = this.current;
    if (this.activity || !pet || this.scene === 'park') return;
    if (this.#actor()?.asleep) return this.#say(`${pet.name}は ねているよ。おきるまで まってね`);
    if (pet.stats.energy < SLEEPY) return this.#say(`${pet.name}は つかれてるみたい。すこし やすませよう`);
    this.#go('こうえんへ いくよ', () => {
      this.#enter('park');
      this.#say(`こうえんに ついた！ ${this.save.pets.length > 1 ? 'みんなで ' : ''}プレゼントを さがそう`);
    });
  }

  goHome(): void {
    if (this.activity || this.scene === 'room') return;
    this.#go('おうちへ かえるよ', () => {
      this.#enter('room');
      this.#say('おうちに かえってきた');
    });
  }

  /** 重ねて押されたら、あとのほうは捨てる */
  #go(label: string, run: () => void) {
    if (this.#move) return;
    this.moving = label;
    this.#move = { run, wait: 2 };
    sounds.door();
  }

  buy(id: ShopItem['id']): 'ok' | 'money' | 'owned' {
    const r = buy(this.save, id);
    if (r === 'ok') {
      sounds.coin();
      this.#dirty = true;
      this.#say(`${itemName(id)}を かったよ`);
      // 試着して買ったものは、そのまま着せておく（外すと買ったのに消えたように見える）
      if (id === this.trying && this.current) {
        this.current.accessory = this.trying;
        this.trying = null;
      }
      if (SHOP.find((i) => i.id === id)?.type === 'room') this.#refreshRoom();
    }
    return r;
  }

  /** 模様替えした部屋を組み直す。ソファの高さと広さもテーマで変わる */
  #refreshRoom() {
    this.#world.refreshRoom();
    if (this.scene === 'room') this.#view.perches = roomPerches(this.save.room);
  }

  /** 買ってある部位に部屋を替える。セットをまとめて替えても、組み直しと音は 1 回 */
  redecorate(look: Partial<RoomLook>): void {
    let changed = false;
    for (const [part, theme] of Object.entries(look) as [RoomPart, RoomTheme][]) {
      if (!hasDecor(this.save.decor, part, theme) || this.save.room[part] === theme) continue;
      this.save.room[part] = theme;
      changed = true;
    }
    if (!changed) return;
    this.#dirty = true;
    this.#refreshRoom();
    this.#music();
    sounds.pop();
  }

  /** ふれあいひろばを出る途中（host.end の組み立て待ち）なら、部屋に入ったときに奥から歩いてくる */
  adopt(breed: BreedId, name: string): 'ok' | 'money' | 'full' {
    const r = adopt(this.save, breed, name);
    if (typeof r === 'string') return r;
    this.#arrival = r.id;
    if (!this.activity) this.#actors.push(this.#welcome(r));
    this.#world.syncPets(this.save.pets);
    this.#fitToy();
    this.#write();
    sounds.learned();
    this.#say(`${r.name}が やってきた！ よろしくね`, 4);
    return 'ok';
  }

  /** 部屋の奥から歩いてきて、手前であいさつする */
  #welcome(pet: Pet): Actor {
    this.#arrival = null;
    const a = createActor(pet, { x: 0.4, z: this.#layout.bounds.z0 + 0.1 });
    command(a, pet, { type: 'call' });
    return a;
  }

  /** まだ持っていないアクセサリーを、いまのペットに見た目だけ付ける。null で元に戻す。着けて見せるため front へ呼ぶ */
  tryOn(acc: AccessoryId | null): void {
    if (acc === this.trying || (acc && (this.activity || this.save.accessories.includes(acc)))) return;
    this.trying = acc;
    if (!acc) return;
    this.call();
    sounds.pop();
  }

  wear(petId: string, acc: AccessoryId | null): void {
    const pet = this.#pet(petId);
    if (!pet || (acc && !this.save.accessories.includes(acc))) return;
    pet.accessory = acc;
    this.#dirty = true;
    sounds.pop();
  }

  photo(): void {
    addPhoto(this.save, this.#world.snapshot());
    this.#count('photo');
    if (!writePhotos(this.save) && !this.#full) {
      this.#full = true;
      this.#say('しゃしんが いっぱいで のこせないよ');
      remember('わんにゃんハウスの記録を保存できませんでした（容量）');
      return;
    }
    this.#fx.flash();
    sounds.shutter();
    this.#say('しゃしんを とったよ');
  }

  setName(petId: string, name: string): void {
    const pet = this.#pet(petId);
    const next = name.trim().slice(0, 12);
    if (!pet || !next) return;
    pet.name = next;
    this.#dirty = true;
  }

  // --- 遊びのモード ---

  /** going は組み立てを待つあいだに出す行き先（「おふろへ いくよ」） */
  start(activity: Activity, going: string): void {
    this.#modes.start(activity, going);
  }

  /** 飼っているペットを連れないモード。0 匹でも始められる */
  visit(mode: Visit, going: string): void {
    this.#modes.visit(mode, going);
  }

  #pause() {
    for (const t of this.#touches) if (t.mode === 'rub') this.#world.setBrush(null);
    this.#touches = [];
    this.#wand.on = false;
    this.trickPending = null;
  }

  dispose(): void {
    this.activity?.exit?.();
    this.#bowls.putBack();
    this.#write(false);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#bgm.stop();
    this.#world.dispose();
  }
}

/** ひとりで鳴くときの鳴き方。おなか・のどがへったら甘え、ねむければあくび */
function moodCry(pet: Pet): Cry {
  const m = mood(pet);
  return m === 'hungry' || m === 'thirsty' ? 'sweet' : m === 'sleepy' ? 'yawn' : 'happy';
}
