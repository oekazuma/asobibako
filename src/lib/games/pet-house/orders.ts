import { command, naughty, type Actor } from './behavior';
import type { Core } from './core';
import { kindOf, play, stroke, type Pet } from './engine';
import type { Toys } from './toys';
import type { FoodId, TrickId } from './types';
import type { Heard } from './voice';

/** Session の画面のボタンと同じ口。声の頼みのうちボタンでもできるものは、ここを通して同じことをする */
export interface Buttons {
  call(): void;
  cheer(): void;
  trick(trick: TrickId): void;
  feed(food: FoodId): void;
  water(): void;
  walk(): void;
  home(): void;
  bath(): void;
  photo(): void;
}

/** これより元気だと、「ねんね」と言っても少し横になるだけで起きる */
const AWAKE = 80;
/** 「まて」から「よし」まで、これだけ待てたらほめられる */
const WAITED = 3;

/** 声の頼みごと（voice.ts の parse の結果）。名前で呼ばれた子への切り替えは Session が先にすませる */
export class Orders {
  readonly #c: Core;
  readonly #toys: Toys;
  readonly #buttons: Buttons;
  /** 「まて」をしている子と、待たせる秒と、待ちきれなくなる時刻 */
  #stay: { petId: string; total: number; end: number } | null = null;
  /** 「まて」ができた子を、この時刻まで「いいこ」でほめられる */
  #waited: { petId: string; until: number } | null = null;
  /** カメラの方を向かせてから撮る時刻 */
  #shootAt: number | null = null;

  constructor(core: Core, toys: Toys, buttons: Buttons) {
    this.#c = core;
    this.#toys = toys;
    this.#buttons = buttons;
  }

  run(h: Heard) {
    const c = this.#c;
    const pet = c.s.current;
    const a = c.actor();
    if (!pet || !a) return;
    c.count('voice');
    const b = this.#buttons;
    switch (h.action) {
      case 'call':
        return b.call();
      case 'praise':
        return b.cheer();
      case 'release':
        return a.stay ? b.call() : b.cheer();
      case 'feed': {
        const food: FoodId = kindOf(pet.breed) === 'dog' ? 'dogfood' : 'catfood';
        if (c.s.scene === 'room' && c.s.save.food[food] <= 0) return c.say('ごはんが ないよ。おみせで かってね');
        return b.feed(food);
      }
      case 'water':
        return b.water();
      case 'walk':
        return c.s.scene === 'room' ? b.walk() : c.say('もう こうえんに いるよ');
      case 'home':
        return c.s.scene === 'room' ? c.say('もう おうちに いるよ') : b.home();
      case 'bath':
        return b.bath();
      case 'photo':
        return this.#photo(pet, a);
      case 'fetch':
        return this.#toys.toss();
      case 'sleep':
        return this.#sleep(pet, a);
      case 'wake':
        if (!a.asleep) return c.say(`${pet.name}は もう おきてるよ`);
        c.voice(pet, 'yawn');
        return command(a, pet, { type: 'wake', stretch: true });
      case 'sofa':
      case 'bed':
        return this.#perch(pet, a, h.action);
      case 'stay':
        return this.#stayHere(pet, a);
      case 'play':
        return this.#play(pet, a);
      case 'scold':
        return this.#scold(pet, a);
      default:
        return b.trick(h.action);
    }
  }

  /** 寝ている・食べている・くわえているあいだは、声で頼んでもできない。できないなら言って true */
  #busy(pet: Pet, a: Actor): boolean {
    const c = this.#c;
    if (a.asleep) c.say(`${pet.name}は ねているよ。「おきて」で おきるよ`);
    else if (a.carrying || a.mode === 'eat' || a.mode === 'drink') c.say('いまは できないみたい');
    else return false;
    return true;
  }

  #sleep(pet: Pet, a: Actor) {
    const c = this.#c;
    if (a.asleep) return c.say(`${pet.name}は もう ねてるよ`);
    if (c.s.scene !== 'room') return c.say('おうちに かえってから ねんね しようね');
    if (this.#busy(pet, a)) return;
    if (pet.stats.energy >= AWAKE) {
      command(a, pet, { type: 'sleep', brief: true });
      return c.say(`${pet.name}は まだ ねむくないみたい`);
    }
    c.count('voiceSleep');
    command(a, pet, { type: 'sleep' });
    c.say(`${pet.name}、ねんね しようね`);
  }

  #perch(pet: Pet, a: Actor, id: 'sofa' | 'bed') {
    const c = this.#c;
    const name = id === 'sofa' ? 'ソファ' : 'ベッド';
    const p = c.view.perches?.find((q) => q.id === id);
    if (!p) return c.say(`${name}は おうちに あるよ`);
    if (a.carrying) return c.say('いまは できないみたい');
    command(a, pet, { type: 'call', to: { x: p.x, z: p.z }, perch: id });
  }

  #stayHere(pet: Pet, a: Actor) {
    const c = this.#c;
    if (this.#busy(pet, a)) return;
    const total = 10 + Math.random() * 10;
    command(a, pet, { type: 'stay', t: total });
    this.#stay = { petId: pet.id, total, end: c.now + total };
    c.say(`${pet.name}、まて… 「よし」で おしまい`, 4);
  }

  /**
   * よぶ（ボタン・「おいで」・「よし」）の前に Session が呼ぶ。「まて」をしていたら、待てた秒でほめられるか決める。
   * 呼ぶこと自体は Session がそのまま続ける
   */
  released(pet: Pet, a: Actor) {
    const s = this.#stay;
    if (!a.stay || s?.petId !== pet.id) return;
    this.#stay = null;
    if (s.total - a.t < WAITED) return;
    const c = this.#c;
    this.#waited = { petId: pet.id, until: c.now + 8 };
    c.fx.sparkle(...c.above(a), 5);
    c.say('まてたね！ 「いいこ」って ほめて あげよう', 4);
  }

  /** 声でほめたとき。「まて」ができた直後なら少しなかよしになって true */
  cheer(): boolean {
    const c = this.#c;
    const pet = c.s.current;
    const a = c.actor();
    const w = this.#waited;
    if (!pet || !a || w?.petId !== pet.id || c.now > w.until) return false;
    this.#waited = null;
    stroke(pet, 8);
    const [x, y] = c.above(a);
    c.fx.hearts(x, y, 5);
    c.fx.text('よく まてたね！', x, y - 30);
    c.voice(pet, 'happy');
    c.changed();
    return true;
  }

  #play(pet: Pet, a: Actor) {
    const c = this.#c;
    if (this.#busy(pet, a)) return;
    if (pet.stats.energy < 30) return c.say(`${pet.name}は つかれてるみたい。すこし やすませよう`);
    command(a, pet, { type: 'play' });
    play(pet, 0.5);
    c.voice(pet, 'happy');
    c.changed();
  }

  /** 怒りすぎない。いたずらをやめて伏せ、少ししゅんとしたらすぐ元にもどる */
  #scold(pet: Pet, a: Actor) {
    const c = this.#c;
    if (!naughty(a)) return c.say(`${pet.name}は いいこに してるよ`);
    const toy = c.view.toy;
    if (toy?.holder === pet.id) {
      toy.holder = null;
      toy.still = false;
      toy.vx = toy.vy = toy.vz = 0;
    }
    // 床に残ったおもちゃを、新しく投げたものと思ってすぐまた追わないように
    a.seen = toy;
    command(a, pet, { type: 'scold' });
    c.voice(pet, 'sweet');
    c.say(`${pet.name}、もう しないって`);
  }

  #photo(pet: Pet, a: Actor) {
    const c = this.#c;
    command(a, pet, { type: 'face' });
    this.#shootAt = c.now + 1;
    c.say('はい チーズ！', 1.5);
  }

  tick() {
    const c = this.#c;
    if (this.#shootAt !== null && c.now >= this.#shootAt) {
      this.#shootAt = null;
      this.#buttons.photo();
    }
    const s = this.#stay;
    const a = s && c.actor(s.petId);
    if (!s || !a || a.stay) return;
    this.#stay = null;
    // 「よし」の前に時間が尽きた。ほかの頼みごとで立ったときは言わない
    const pet = c.pet(s.petId);
    if (pet && c.now > s.end - 0.2) c.say(`${pet.name}は まちきれなかったみたい。はやめに「よし」って いってね`, 4);
  }
}
