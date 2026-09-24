import type { Activity, ActivityScene, Visit } from './activity';
import {
  command,
  createActor,
  eats,
  think,
  throwToy,
  type Actor,
  type BehaviorEvent,
  type WorldView,
  wandBalls,
  wandBite
} from './behavior';
import { hasDecor, type RoomLook, type RoomPart, type RoomTheme } from './decor';
import { PetFx } from './effects';
import {
  SHOP,
  SLEEPY,
  TRICKS,
  TRICK_REWARD,
  addPhoto,
  adopt,
  brush,
  buy,
  catchUp,
  drink,
  eat,
  findPresent,
  kindOf,
  loadSave,
  mood,
  newSave,
  play,
  praise,
  rest,
  stroke,
  tick,
  trickChance,
  writePhotos,
  writeSave,
  type Pet,
  type Save,
  type ShopItem
} from './engine';
import { LAYOUTS, PARK, ROOM, type Layout, type Spot } from './layout';
import { sounds } from './sounds';
import type { AccessoryId, BaseScene, BreedId, FoodId, Scene, ToyId, TrickId } from './types';
import { createWand, POM, stepWand, type Wand } from './wand';
import { PetWorld } from './world3d';

export type Tool = 'hand' | 'brush' | 'toy';

/**
 * わんにゃんハウスの進行。画面（PetHouse.svelte）はこの状態を読み、ボタンと指をここへ渡す。
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

  readonly #world: PetWorld;
  readonly #overlay: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D | null;
  readonly #fx = new PetFx();
  readonly #onhint?: (t: string) => void;
  #actors: Actor[] = [];
  /** モードが 3D に出している子。あいだは飼っているペットの代わりにこの子たちを描く */
  #cast: { pets: Pet[]; actors: Actor[] } | null = null;
  #layout: Layout = ROOM;
  #view: WorldView;
  /** モードを始める前の道具。モードがおもちゃを持ち替えても、終わったら戻す */
  #before: { tool: Tool; toy: ToyId } = { tool: 'hand', toy: 'ball' };
  /** 部屋のお皿。公園へ行っても残しておく */
  #bowls: WorldView['bowls'] = { food: null, foodLeft: 0, waterLeft: 0 };
  #touches: Touch[] = [];
  /** ねこじゃらしのふさ。指の下の点（tx, tz）を少し遅れて追う */
  /** plane は持ち上げはじめたときの立てた面の奥行き。寄ってくる子に合わせて動かすと、ふさが手前へ逃げ続ける */
  #wand = { tx: 0, ty: 0, tz: 0, on: false, rig: null as Wand | null, plane: null as number | null };
  #now = 0;
  #slow = 0;
  #w = 1;
  #h = 1;
  #hint = '';
  #toastUntil = 0;
  #dirty = false;
  #wrote = 0;
  #presentId = 0;
  #presentWait = 0;
  /** 開いてから 1 度でもなでたか。まだなら何をすればいいかをヒントに出す */
  #stroked = false;
  #timers = { heart: 0, purr: 0, bark: 2, sparkle: 0, munch: 0, zzz: 0, rustle: 0 };
  /**
   * 場面の組み立ては数百 ms 画面を止める。wait フレーム待って「いどうちゅう」を 1 度描かせてから run し、
   * シェーダーの準備が落ち着くまでさらに数フレーム出したままにする
   */
  #move: { run: (() => void) | null; wait: number } | null = null;
  /** むかえたばかりの子。次に部屋へ入ったとき、奥から歩いてこさせる */
  #arrival: string | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, onhint?: (t: string) => void) {
    this.#onhint = onhint;
    this.#overlay = overlay;
    this.#ctx = overlay.getContext('2d');
    this.#world = new PetWorld(canvas);
    this.#view = this.#emptyView('room');
    this.#world.trophies = this.save.contest;
    this.#world.room = this.save.room;
    const { allowance } = catchUp(this.save, Date.now());
    this.#enter('room');
    this.#fitToy();
    if (allowance) this.#say(`おこづかい ${allowance}コイン もらったよ！`);
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  #onVisibility = () => {
    if (document.visibilityState === 'hidden') return this.#write();
    const { allowance } = catchUp(this.save, Date.now());
    if (allowance) this.#say(`おこづかい ${allowance}コイン もらったよ！`);
  };

  #emptyView(scene: Scene): WorldView {
    return { scene, layout: this.#layout, bowls: this.#bowls, toy: null, wand: null, presents: [] };
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
    if (scene === 'park') for (let i = 0; i < 3; i++) this.#spawnPresent();
  }

  /** 部屋には全員、公園にはいまのペットだけ。front のまわりに並べる */
  #spawnActors() {
    const front = this.#layout.front;
    const pets = this.scene === 'room' ? this.save.pets : this.save.pets.filter((p) => p.id === this.save.current);
    this.#actors = pets.map((p, i) =>
      p.id === this.#arrival && this.scene === 'room'
        ? this.#welcome(p)
        : createActor(p, { x: front.x + [0, -0.55, 0.55][i % 3], z: front.z - 0.25 - (i ? 0.3 : 0) })
    );
    // 公園で咥えていた子と入れ替わったら、おもちゃはその場に落とす（いない子が咥えたままだと誰も拾えない）
    const toy = this.#view.toy;
    if (toy?.holder && !this.#actor(toy.holder)) {
      toy.holder = null;
      toy.still = false;
      toy.vx = toy.vy = toy.vz = 0;
    }
    this.#world.syncPets(this.save.pets);
  }

  #spawnPresent() {
    const b = PARK.bounds;
    for (let i = 0; i < 12; i++) {
      const p = {
        x: b.x0 + 0.3 + Math.random() * (b.x1 - b.x0 - 0.6),
        z: b.z0 + 0.4 + Math.random() * (b.z1 - b.z0 - 1.8)
      };
      const clear =
        PARK.blocks.every((k) => Math.hypot(p.x - k.x, p.z - k.z) > k.r + 0.35) &&
        this.#actors.every((a) => Math.hypot(p.x - a.x, p.z - a.z) > 1) &&
        this.#view.presents.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 1);
      if (!clear) continue;
      this.#view.presents.push({ id: ++this.#presentId, ...p });
      return;
    }
  }

  #actor(petId = this.save.current) {
    return this.#actors.find((a) => a.petId === petId);
  }

  #pet(petId: string) {
    return this.save.pets.find((p) => p.id === petId);
  }

  /** ペットの頭の上あたりの画面の位置 */
  #above(a: Actor, y = 0.42): [number, number] {
    const [x, sy] = this.#world.project(a.x, y, a.z);
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

  #write() {
    writeSave($state.snapshot(this.save));
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
        if (a.asleep) rest(pet, step);
        if (this.scene === 'park' && a.v > 0.05) play(pet, step / 20);
      }
    }
    this.activity?.frame(dt);
    // frame の中で host.end() を呼んだモードには、もう出来事を渡さない
    const act = this.activity;
    if (!act?.drives) {
      this.#view.current = this.save.current;
      this.#stepWand(dt);
      this.#rub(dt);
      for (const e of think(this.#actors, pets, this.#view, dt, Math.random)) if (!act?.event?.(e)) this.#event(e);
    }
    this.#ambient(dt);
    const away = !this.activity && this.#toyAway();
    if (away !== this.away) this.away = away;

    if (this.trickPending && this.#now > this.trickPending.until) this.trickPending = null;
    if (this.toast && this.#now > this.#toastUntil) this.toast = '';
    const hint =
      this.toast || (this.activity ? '' : this.trying ? `${this.current?.name}に にあうかな？` : this.#moodText());
    if (hint !== this.#hint) {
      this.#hint = hint;
      this.#onhint?.(hint);
    }
    if ((this.#dirty && this.#now - this.#wrote > 1) || this.#now - this.#wrote > 30) this.#write();

    const cast = this.#cast;
    const trying = this.trying;
    // おみせのシートが画面の下半分をふさぐので、試着のあいだは絵を上へずらしてペットを見せる
    this.#world.lift = trying ? 0.36 : 0;
    const shown = trying ? pets.map((p) => (p.id === this.save.current ? { ...p, accessory: trying } : p)) : pets;
    this.#world.syncPets(cast ? [...shown, ...cast.pets] : shown);
    this.#world.update(cast?.actors ?? this.#actors, this.#view, dt, this.#now, this.save.current, this.tool);
    this.#world.render();
    this.#fx.step(dt);
    const ctx = this.#ctx;
    if (!ctx) return;
    const dpr = this.#overlay.width / this.#w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);
    this.#fx.draw(ctx, this.#w, this.#h);
  }

  /** 食べる音・寝息の Z・公園のプレゼントの補充 */
  #ambient(dt: number) {
    const t = this.#timers;
    t.munch -= dt;
    t.zzz -= dt;
    for (const a of this.#actors) {
      if ((a.mode === 'eat' || a.mode === 'drink') && t.munch <= 0) {
        t.munch = 0.7;
        (a.mode === 'eat' ? sounds.eat : sounds.drink)();
      }
      if (a.asleep && t.zzz <= 0) {
        t.zzz = 1.3;
        const [x, y] = this.#above(a, 0.3);
        this.#fx.text('Z', x + 20, y, '#7a8cff', 26);
      }
    }
    // 見ているだけで拾えるので、何匹いても 1 分に 1 つほどに抑える（おさんぽは道に 3 つ）
    if (this.scene !== 'park' || this.#view.presents.length >= 1) return;
    this.#presentWait -= dt;
    if (this.#presentWait > 0) return;
    this.#presentWait = 45;
    this.#spawnPresent();
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
        return `${n}が よごれてるよ。ブラシで きれいに しよう`;
      case 'sleepy':
        return `${n}は ねむそう`;
      default:
        return !this.#stroked && pet.love < 1 ? `${n}を ゆびで なでて あげよう` : '';
    }
  }

  #event(e: BehaviorEvent) {
    const pet = this.#pet(e.petId);
    const a = this.#actor(e.petId);
    if (!pet || !a) return;
    const [x, y] = this.#above(a);
    this.#dirty = true;
    switch (e.type) {
      case 'ate':
        eat(pet, e.food);
        this.#fx.hearts(x, y, 3);
        return;
      case 'drank':
        drink(pet);
        this.#fx.hearts(x, y, 2);
        return;
      case 'fetched':
        play(pet);
        this.#fx.hearts(x, y, 4);
        this.#fx.text('よく できました！', x, y - 30);
        return;
      case 'caught':
        play(pet);
        sounds.catch();
        this.#fx.sparkle(x, y, 4);
        return;
      case 'leap':
        sounds.leap();
        return;
      case 'found':
        play(pet);
        return this.#found(pet, x, y);
      case 'voice':
        this.#voice(pet);
        this.#fx.note(x, y);
        return;
    }
  }

  #voice(pet: Pet) {
    if (kindOf(pet.breed) === 'cat') sounds.meow();
    else if (pet.breed === 'poodle') sounds.smallBark();
    else sounds.bark();
  }

  #found(pet: Pet, x: number, y: number) {
    const found = findPresent(this.save, Math.random);
    if ('money' in found) {
      this.#fx.coins(x, y, this.#purse(), Math.min(8, Math.round(found.money / 10)));
      this.#fx.text(`+${found.money}`, x, y - 20, '#e39a00', 40);
      sounds.coin();
      this.#say(`${pet.name}が ${found.money}コインを みつけた！`);
    } else if ('item' in found) {
      this.#fx.confetti(x, y);
      sounds.learned();
      this.#say(`${pet.name}が ${found.item.name}を みつけた！`, 4);
    } else {
      this.#fx.sparkle(x, y, 5);
      sounds.sparkle();
      this.#say(`${pet.name}が ${itemName(found.food)}を ${found.count}こ みつけた！`);
    }
  }

  // --- 指 ---

  down(id: number, px: number, py: number): void {
    const act = this.activity;
    if (act && (act.down?.(id, px, py) || act.drives)) return;
    if (!this.current || !this.#actors.length) return;
    if (!act && this.#pickUp(px, py)) return;
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
      mode: 'floor'
    };
    this.#touches.push(touch);
    if (this.tool === 'toy') {
      touch.mode = this.toy === 'wand' ? 'wand' : 'throw';
      if (touch.mode === 'wand') this.#aimWand(px, py);
      return;
    }
    const hit = this.#world.pick(px, py);
    if (!hit) return;
    touch.mode = 'rub';
    touch.pet = hit;
    if (hit !== this.save.current) this.select(hit);
  }

  move(id: number, px: number, py: number): void {
    if (this.activity?.move?.(id, px, py)) return;
    const touch = this.#touches.find((t) => t.id === id);
    if (!touch) return;
    const d = Math.hypot(px - touch.x, py - touch.y);
    touch.moved += d;
    touch.x = px;
    touch.y = py;
    if (touch.mode === 'wand') return this.#aimWand(px, py);
    if (touch.mode === 'throw') return;
    const hit = this.#world.pick(px, py);
    // 床から指をすべらせてペットに乗ったら、そこからなではじめる
    if (touch.mode === 'floor' && hit && touch.moved > 20) {
      touch.mode = 'rub';
      touch.pet = hit;
    }
    if (touch.mode === 'rub' && hit === touch.pet) touch.rub += d;
  }

  up(id: number, px: number, py: number, vx: number, vy: number): void {
    if (this.activity?.up?.(id, px, py, vx, vy)) return;
    const touch = this.#touches.find((t) => t.id === id);
    this.#touches = this.#touches.filter((t) => t !== touch);
    if (!touch) return;
    if (touch.mode === 'rub') this.#world.setBrush(null);
    if (touch.mode === 'wand') this.#wand.on = this.#touches.some((t) => t.mode === 'wand');
    if (touch.mode === 'throw') this.#throw(touch, px, py, vx, vy);
    if (touch.mode === 'floor' && touch.moved < 16 && this.#now - touch.t0 < 0.6) this.#callTo(px, py);
  }

  /** なでる・ブラシ。このフレームに指がペットの上で動いた距離だけ効く */
  #rub(dt: number) {
    const t = this.#timers;
    for (const k of ['heart', 'purr', 'bark', 'sparkle'] as const) t[k] -= dt;
    for (const touch of this.#touches) {
      if (touch.mode !== 'rub' || !touch.pet) continue;
      const pet = this.#pet(touch.pet);
      const a = this.#actor(touch.pet);
      const brushing = this.tool === 'brush';
      if (brushing) this.#world.setBrush(this.#brushAt(touch));
      const amount = Math.min(touch.rub / (this.#h * 0.3), dt * 2);
      touch.rub = 0;
      if (!pet || !a || a.asleep || amount <= 0) continue;
      command(a, pet, { type: brushing ? 'brush' : 'stroke' });
      this.#dirty = true;
      if (brushing) {
        const was = pet.stats.clean;
        brush(pet, amount);
        if (t.sparkle <= 0) {
          t.sparkle = 0.18;
          this.#fx.sparkle(touch.x, touch.y);
        }
        // 遊んでいるあいだの減りで 99.9 になっただけのときは出さない（こするたびに出てしまう）
        if (was < 95 && pet.stats.clean >= 100) {
          const [x, y] = this.#above(a);
          this.#fx.text('ぴかぴか！', x, y, '#1f9bff', 36);
          sounds.sparkle();
        }
        continue;
      }
      stroke(pet, amount);
      this.#stroked = true;
      if (t.heart <= 0) {
        t.heart = 0.22;
        this.#fx.hearts(touch.x, touch.y - 20);
      }
      const cat = kindOf(pet.breed) === 'cat';
      if (cat && t.purr <= 0) {
        t.purr = 1.05;
        sounds.purr();
      }
      if (!cat && t.bark <= 0) {
        t.bark = 2.5 + Math.random() * 2;
        if (Math.random() < 0.5) {
          this.#voice(pet);
          this.#fx.note(...this.#above(a));
        }
      }
      const pending = this.trickPending;
      if (pending?.petId === pet.id) this.#praise(pet, a, pending.trick);
    }
  }

  #brushAt(touch: Touch) {
    const p = this.#world.floor(touch.x, touch.y, 0.26);
    return p && { x: p.x, y: 0.26, z: p.z };
  }

  #praise(pet: Pet, a: Actor, trick: TrickId) {
    this.trickPending = null;
    const [x, y] = this.#above(a);
    const { learned } = praise(pet, trick);
    this.#fx.hearts(x, y, 5);
    if (!learned) {
      this.#fx.text('いいこ！', x, y - 30);
      sounds.sparkle();
      return;
    }
    this.save.money += TRICK_REWARD;
    const t = TRICKS.find((k) => k.id === trick);
    const name = t ? (kindOf(pet.breed) === 'dog' ? t.dog : t.cat) : '';
    this.#say(`「${name}」を おぼえた！ +${TRICK_REWARD}コイン`, 4);
    this.#fx.confetti(x, y);
    this.#fx.coins(x, y, this.#purse(), 6);
    sounds.learned();
  }

  #isDog(petId: string) {
    const pet = this.#pet(petId);
    return !!pet && kindOf(pet.breed) === 'dog';
  }

  /** 投げたおもちゃが、咥えられているか動いているか、front から離れた床にある */
  #toyAway(): boolean {
    const t = this.#view.toy;
    if (!t || t.kind === 'wand') return false;
    const front = this.#layout.front;
    return !!t.holder || !t.still || Math.hypot(t.x - front.x, t.z - front.z) > 0.7;
  }

  /** 床に残ったおもちゃ（咥えたまま寝た子のものも）をタップして拾い、手元に戻す */
  #pickUp(px: number, py: number): boolean {
    const t = this.#view.toy;
    if (!t || !this.away) return false;
    const holder = t.holder ? this.#actor(t.holder) : undefined;
    if (t.holder && !holder?.asleep) return false;
    const [x, y] = this.#world.project(t.x, t.y, t.z);
    if (Math.hypot(px - x, py - y) > 60) return false;
    if (holder) holder.carrying = null;
    this.#view.toy = null;
    this.away = false;
    this.#fx.sparkle(x, y, 3);
    sounds.pop();
    return true;
  }

  #clampToFloor(p: Spot): Spot {
    const b = this.#layout.bounds;
    const q = { x: Math.min(b.x1, Math.max(b.x0, p.x)), z: Math.min(b.z1, Math.max(b.z0, p.z)) };
    for (const k of this.#layout.blocks) {
      const d = Math.hypot(q.x - k.x, q.z - k.z);
      const need = k.r + 0.22;
      if (d >= need || d < 1e-6) continue;
      q.x = k.x + ((q.x - k.x) / d) * need;
      q.z = k.z + ((q.z - k.z) / d) * need;
    }
    return q;
  }

  #callTo(px: number, py: number) {
    const pet = this.current;
    const a = this.#actor();
    const p = this.#world.floor(px, py);
    if (!pet || !a || !p) return;
    this.#fx.ripple(px, py);
    command(a, pet, { type: 'call', to: this.#clampToFloor(p) });
  }

  /**
   * ふさは指の下の床の点へ運ぶ。指がいまの子のそばで足元より上へ行く（床の点がその子の奥になる）と、
   * その子の顔の前に立てた面の点へぶら下げ、指の高さまで持ち上げる。指が面の手前の床へ戻るまで持ち上げたまま
   */
  #aimWand(px: number, py: number) {
    const p = this.#world.floor(px, py);
    const q = p && this.#clampToFloor(p);
    let t = q && { x: q.x, y: 0, z: q.z };
    const a = this.#actor();
    const w = this.#wand;
    if (!w.on) w.plane = null;
    const plane = w.plane ?? (a ? this.#clampToFloor({ x: a.x, z: a.z + 0.15 }).z : null);
    const lift = plane === null ? null : this.#world.upright(px, py, plane);
    const over = !!lift && lift.y > 0;
    if (w.plane === null && over && a && Math.abs(lift.x - a.x) < 0.3) w.plane = plane;
    else if (!over) w.plane = null;
    if (lift && w.plane !== null) t = { x: lift.x, y: Math.min(lift.y, 0.6), z: lift.z };
    if (!t) return;
    [w.tx, w.ty, w.tz] = [t.x, t.y, t.z];
    if (!w.on) w.rig = createWand(t);
    w.on = true;
  }

  #stepWand(dt: number) {
    const w = this.#wand;
    if (!w.on || !w.rig) {
      this.#view.wand = null;
      return;
    }
    const rig = w.rig;
    stepWand(rig, { x: w.tx, y: w.ty, z: w.tz }, dt, wandBite(this.#actors), wandBalls(this.#actors));
    const p = rig.nodes[POM];
    this.#view.wand = { x: p.x, y: p.y, z: p.z, moving: rig.speed > 0.15, rig };
    const t = this.#timers;
    t.rustle -= dt;
    if (rig.speed > 1.2 && t.rustle <= 0) {
      t.rustle = 0.22;
      sounds.rustle(Math.min(1, rig.speed / 3));
    }
  }

  /**
   * はじいた向きは、指の下の床の点と、はじいた先の床の点を結んで決める（画面の上へはじけば奥へ飛ぶ）。
   * 速さは画面の高さに対する指の速さで決め、上へ強くはじくほど遠くへ飛ぶ
   */
  #throw(touch: Touch, px: number, py: number, vx: number, vy: number) {
    const kind = this.toy;
    if (kind === 'wand') return;
    const out = this.#view.toy;
    if (this.away && !this.activity && out) {
      if (out.still && !out.holder) return this.#say('おもちゃを タップして ひろってね', 2);
      const chaser = this.#actors.find((a) => a.mode === 'chase' && this.#isDog(a.petId));
      const pet = this.#pet(out.holder ?? chaser?.petId ?? this.save.current);
      const dog = pet && kindOf(pet.breed) === 'dog';
      return this.#say(dog ? `${pet.name}が もってくるまで まってね` : 'おもちゃが とまるまで まってね', 2);
    }
    const rolled = kind === 'mouse';
    const speed = Math.hypot(vx, vy) / this.#h;
    if (speed < 0.35) {
      const y = rolled ? 0.03 : 0.3;
      const p = this.#clampToFloor(this.#world.floor(px, py) ?? this.#layout.front);
      this.#view.toy = throwToy(kind, { x: p.x, y, z: p.z }, { x: 0, y: 0, z: 0 });
      return;
    }
    // 手に持った高さから投げる。指を置いた床の点から出すと、足もとのペットにすぐ当たってしまう
    const from = this.#clampToFloor(this.#world.floor(touch.sx, touch.sy) ?? this.#layout.front);
    const at = this.#world.floor(px, py);
    const ahead = at && this.#world.floor(px + vx * 0.05, py + vy * 0.05);
    let dx = ahead && at ? ahead.x - at.x : vx / (Math.hypot(vx, vy) * 2);
    let dz = ahead && at ? ahead.z - at.z : -1;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // コンテストの会場のような外の場面も、公園と同じだけ遠くへ飛ばせる
    const park = this.scene !== 'room';
    const up = Math.max(0, -vy / this.#h);
    // カメラが低いので、高く上げると画面の上へ消える。遠くへは横の速さで飛ばす
    const [h, v] =
      kind === 'frisbee'
        ? [Math.min(1 + speed * 1.8, park ? 8 : 5), Math.min(0.4 + up * 0.2, 1.2)]
        : kind === 'ball'
          ? [Math.min(0.8 + speed * 1.5, park ? 7 : 5), Math.min(1 + up * 0.35, park ? 3.2 : 2.3)]
          : [Math.min(speed * 1.4, 3.5), 0];
    const y = rolled ? 0.03 : 0.55;
    this.#view.toy = throwToy(kind, { x: from.x, y, z: from.z }, { x: dx * h, y: v, z: dz * h });
    sounds.throw();
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
    if (this.scene === 'park') this.#spawnActors();
  }

  setTool(tool: Tool, toy?: ToyId): void {
    this.tool = tool;
    if (toy) this.toy = toy;
  }

  feed(food: FoodId): void {
    const pet = this.current;
    if (this.scene !== 'room') return this.#say('ごはんは おうちで あげようね');
    if (this.save.food[food] <= 0) return this.#say(`${itemName(food)}が もう ないよ。おみせで かおう`);
    const bowl = this.#bowls;
    if (bowl.foodLeft > 0.3) {
      // 犬と猫がいると、片方の食べものが残ったままもう片方が食べられなくなる。いまのペットが食べないものなら入れ替える
      if (!pet || !bowl.food || eatsFood(pet, bowl.food)) return this.#say('まだ ごはんが のこってるよ');
      if (bowl.foodLeft > 0.9) this.save.food[bowl.food] += 1;
    }
    this.save.food[food] -= 1;
    this.#bowls.food = food;
    this.#bowls.foodLeft = 1;
    this.#dirty = true;
    sounds.pop();
    if (pet && !eatsFood(pet, food)) this.#say(`${pet.name}は ${itemName(food)}を たべないみたい`);
  }

  water(): void {
    if (this.scene !== 'room') return this.#say('おみずは おうちで あげようね');
    this.#bowls.waterLeft = 1;
    sounds.pop();
  }

  call(): void {
    const pet = this.current;
    const a = this.#actor();
    if (pet && a) command(a, pet, { type: 'call' });
  }

  trick(trick: TrickId): void {
    if (this.activity) return this.activity.trick?.(trick);
    const pet = this.current;
    const a = this.#actor();
    if (!pet || !a) return;
    if (a.asleep || a.carrying || a.mode === 'eat' || a.mode === 'drink') return this.#say('いまは できないみたい');
    const success = Math.random() < trickChance(pet, trick);
    command(a, pet, { type: 'trick', trick, success });
    const [x, y] = this.#above(a);
    if (success) {
      this.trickPending = { petId: pet.id, trick, until: this.#now + 4 };
      this.#fx.sparkle(x, y, 4);
      this.#say('できた！ すぐに なでて ほめて あげよう');
    } else {
      this.trickPending = null;
      this.#fx.text('？', x, y, '#1f9bff', 44);
      this.#say('うまく できなかった。もう いちど');
    }
  }

  /** いまのペットが寝ている。おさんぽ（モード）を始める前に画面が確かめる */
  get asleep(): boolean {
    return !!this.#actor()?.asleep;
  }

  goPark(): void {
    const pet = this.current;
    if (this.activity || !pet || this.scene === 'park') return;
    if (this.#actor()?.asleep) return this.#say(`${pet.name}は ねているよ。おきるまで まってね`);
    if (pet.stats.energy < SLEEPY) return this.#say(`${pet.name}は つかれてるみたい。すこし やすませよう`);
    this.#go('こうえんへ いくよ', () => {
      this.#enter('park');
      this.#say('こうえんに ついた！ プレゼントを さがそう');
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
      if (SHOP.find((i) => i.id === id)?.type === 'room') this.#world.refreshRoom();
    }
    return r;
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
    this.#world.refreshRoom();
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
    writePhotos(this.save);
    this.#fx.flash();
    sounds.shutter();
    this.#say('しゃしんを とったよ');
  }

  // --- 遊びのモード ---

  /** going は組み立てを待つあいだに出す行き先（「おふろへ いくよ」） */
  start(activity: Activity, going: string): void {
    const pet = this.current;
    if (this.activity || !pet) return;
    if (activity.awakeOnly && this.asleep) return this.#say(`${pet.name}は ねているよ。おきるまで まってね`);
    this.#go(going, () => {
      if (this.activity) return;
      this.#pause();
      const a = this.#actor();
      if (a) command(a, pet, { type: 'wake' });
      this.activity = activity;
      activity.enter(this.#host(pet));
    });
  }

  /** 飼っているペットを連れないモード。0 匹でも始められる */
  visit(mode: Visit, going: string): void {
    if (this.activity) return;
    this.#go(going, () => {
      if (this.activity) return;
      this.#pause();
      this.activity = mode;
      mode.enter(this.#host(null));
    });
  }

  #pause() {
    for (const t of this.#touches) if (t.mode === 'rub') this.#world.setBrush(null);
    this.#touches = [];
    this.#wand.on = false;
    this.trickPending = null;
    this.#before = { tool: this.tool, toy: this.toy };
  }

  #end(scene: BaseScene = 'room') {
    const act = this.activity;
    if (!act) return;
    this.activity = null;
    this.#cast = null;
    act.exit?.();
    this.#world.trophies = this.save.contest;
    this.#world.room = this.save.room;
    this.#enter(scene);
    this.setTool(this.#before.tool, this.#before.toy);
    this.#fitToy();
    this.#write();
  }

  #host<P extends Pet | null>(pet: P) {
    // view と actor は場面に入るたびに作り直すので、読むたびに今のものを返す
    const view = () => this.#view;
    const actor = () => (pet ? this.#actor(pet.id) : undefined);
    const size = () => [this.#w, this.#h] as const;
    return {
      save: this.save,
      pet,
      get actor() {
        return actor();
      },
      get view() {
        return view();
      },
      fx: this.#fx,
      world: this.#world,
      get size() {
        return size();
      },
      enter: (scene: ActivityScene) => this.#enter(scene),
      cast: (pets: Pet[], actors: Actor[]) => void (this.#cast = { pets, actors }),
      setTool: (tool: Tool, toy?: ToyId) => this.setTool(tool, toy),
      say: (text: string, seconds?: number) => this.#say(text, seconds),
      above: (a: Actor, y?: number) => this.#above(a, y),
      purse: () => this.#purse(),
      voice: () => void (pet && this.#voice(pet)),
      changed: () => (this.#dirty = true),
      found: (a: Actor) => {
        const p = this.#pet(a.petId);
        if (!p) return;
        play(p);
        this.#found(p, ...this.#above(a));
      },
      end: (scene?: BaseScene) =>
        this.#go(scene === 'park' ? 'こうえんへ いくよ' : 'おうちへ かえるよ', () => this.#end(scene))
    };
  }

  dispose(): void {
    this.activity?.exit?.();
    // お皿は保存しないので、入れたばかりで手つかずのごはんは在庫へ戻す
    const bowl = this.#bowls;
    if (bowl.food && bowl.foodLeft > 0.9) this.save.food[bowl.food] += 1;
    this.#write();
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#world.dispose();
  }

  /** 声で「いいこ」とほめたとき。芸の直後なら、なでてほめたのと同じに数える */
  cheer(): void {
    const pet = this.current;
    const a = this.#actor();
    if (!pet || !a) return;
    const pending = this.trickPending;
    if (pending?.petId === pet.id) return this.#praise(pet, a, pending.trick);
    this.#fx.hearts(...this.#above(a), 2);
    this.#voice(pet);
  }

  /** 名前と、声で覚えさせた呼び名を書きかえる */
  setName(petId: string, name: string, calls: string[]): void {
    const pet = this.#pet(petId);
    const next = name.trim().slice(0, 12);
    if (!pet || !next) return;
    pet.name = next;
    pet.calls = calls;
    this.#dirty = true;
  }
}

interface Touch {
  id: number;
  x: number;
  y: number;
  /** 置いた位置 */
  sx: number;
  sy: number;
  t0: number;
  moved: number;
  /** このフレームにペットの上で動いた距離（ピクセル） */
  rub: number;
  pet: string | null;
  mode: 'rub' | 'floor' | 'wand' | 'throw';
}

const eatsFood = (pet: Pet, food: FoodId) => eats(kindOf(pet.breed) === 'dog', food);

const itemName = (id: ShopItem['id']) => SHOP.find((i) => i.id === id)?.name ?? '';
