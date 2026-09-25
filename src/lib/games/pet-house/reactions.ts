import type { BehaviorEvent } from './behavior';
import { speakAt } from './cries';
import { drink, eat, findPresent, itemName, kindOf, play, type Pet } from './engine';
import { PARK } from './layout';
import { FEEL, type Feel } from './petting';
import type { Core } from './core';
import { sounds, type Surface } from './sounds';
import type { Actor } from './behavior';
import type { Scene } from './types';

/** ペットの出来事（食べた・持ってきた・なでられた…）の演出と、食べる音・寝息・公園のプレゼント */
export class Reactions {
  readonly #c: Core;
  #munch = 0;
  #zzz = 0;
  #snore = 0;
  #presentId = 0;
  #presentWait = 0;
  /** 足音の次の 1 歩までの秒と、跳んでいたか（降りた瞬間を知る） */
  readonly #feet = new WeakMap<Actor, { step: number; air: boolean }>();
  #lastStep = 0;

  constructor(core: Core) {
    this.#c = core;
  }

  event(e: BehaviorEvent) {
    const c = this.#c;
    const pet = c.pet(e.petId);
    const a = c.actor(e.petId);
    if (!pet || !a) return;
    const [x, y] = c.above(a);
    c.changed();
    switch (e.type) {
      case 'ate':
        c.count('meal');
        eat(pet, e.food);
        c.fx.hearts(x, y, 3);
        return;
      case 'drank':
        drink(pet);
        c.fx.hearts(x, y, 2);
        return;
      case 'fetched':
        c.count('fetch');
        play(pet);
        if (a.mode === 'offer') return c.say(`${pet.name}の くちの おもちゃを タップして うけとろう`, 4);
        c.fx.hearts(x, y, 4);
        c.fx.text('よく できました！', x, y - 30);
        return;
      case 'urge':
        c.fx.text('なげて！', x, y - 30);
        return;
      case 'played':
        play(pet, 0.2);
        c.fx.hearts(x, y, 1);
        return;
      case 'caught':
        play(pet);
        sounds.catch();
        c.fx.sparkle(x, y, 4);
        return;
      case 'leap':
        if (c.view.wand && !a.hop) c.count('leap');
        sounds.leap();
        return;
      case 'found':
        play(pet);
        return this.found(pet, x, y);
      case 'voice':
        c.voice(pet, e.cry);
        c.fx.note(x, y);
        return;
      case 'sleep':
        if (a.perch === 'sofa') c.count('nap');
        if (a.perch && c.actors.some((o) => o !== a && o.asleep && o.perch === a.perch)) c.count('napTogether');
        return c.voice(pet, 'yawn');
      case 'petted':
        return this.#petted(pet, e.feel, x, y);
      case 'social':
        return this.#social(pet, e.with, e.kind, x, y);
    }
  }

  /** ペット同士のかかわり。ハートと音符は 2 匹のあいだに出す */
  #social(pet: Pet, other: string, kind: Extract<BehaviorEvent, { type: 'social' }>['kind'], x: number, y: number) {
    const c = this.#c;
    const b = c.actor(other);
    const [bx, by] = b ? c.above(b) : [x, y];
    const [mx, my] = [(x + bx) / 2, (y + by) / 2];
    const cat = kindOf(pet.breed) === 'cat';
    switch (kind) {
      case 'greet':
        c.fx.note(x, y);
        c.fx.hearts(mx, my, 1);
        return c.voice(pet, cat ? 'sweet' : 'happy');
      case 'invite':
      case 'rival':
        c.fx.note(x, y);
        return cat ? undefined : c.voice(pet, 'happy');
      case 'refuse':
        return c.voice(pet, 'grumble');
      case 'groom':
        c.fx.hearts(bx, by, 2);
        return c.voice(pet, cat ? 'purr' : 'sweet');
      case 'snuggle':
        return c.fx.hearts(mx, my, 2);
      case 'done':
        c.fx.hearts(mx, my, 3);
        return c.fx.text('なかよし！', mx, my - 40);
    }
  }

  #petted(pet: Pet, feel: Feel, x: number, y: number) {
    const fx = this.#c.fx;
    const f = FEEL[feel];
    const n = 1 + Math.floor(pet.love / 2);
    const sour = feel === 'enough' || feel === 'flick' || feel === 'swat';
    fx.text(f.say, x, y - 72, sour ? '#9a7b66' : '#ff5fa2', 30);
    this.#c.voice(pet, f.cry[kindOf(pet.breed)]);
    if (feel === 'melt') {
      fx.hearts(x, y, 2 + n);
      fx.sparkle(x, y, 3);
    } else if (feel === 'like') {
      fx.hearts(x, y, n);
      fx.note(x, y);
    } else if (feel === 'swat') fx.sparkle(x, y, 2);
    else if (!sour) fx.note(x, y);
  }

  /** プレゼントを開けて中身をもらう */
  found(pet: Pet, x: number, y: number) {
    const c = this.#c;
    c.count('found');
    const found = findPresent(c.s.save, Math.random);
    sounds.unwrap();
    if ('money' in found) {
      c.fx.coins(x, y, c.purse(), Math.min(8, Math.round(found.money / 10)));
      c.fx.text(`+${found.money}`, x, y - 20, '#e39a00', 40);
      sounds.coin();
      c.say(`${pet.name}が ${found.money}コインを みつけた！`);
    } else if ('item' in found) {
      c.fx.confetti(x, y);
      sounds.learned();
      c.say(`${pet.name}が ${found.item.name}を みつけた！`, 4);
    } else {
      c.fx.sparkle(x, y, 5);
      sounds.sparkle();
      c.say(`${pet.name}が ${itemName(found.food)}を ${found.count}こ みつけた！`);
    }
  }

  /** 食べる音・寝息の Z・足音・公園のプレゼントの補充 */
  ambient(dt: number) {
    const c = this.#c;
    this.#munch -= dt;
    this.#zzz -= dt;
    this.#lastStep += dt;
    for (const a of c.actors) {
      this.#footsteps(a, dt);
      if ((a.mode === 'eat' || a.mode === 'drink') && this.#munch <= 0) {
        this.#munch = 0.7;
        (a.mode === 'eat' ? sounds.eat : sounds.drink)();
      }
      if (a.asleep && this.#zzz <= 0) {
        this.#zzz = 1.3;
        const [x, y] = c.above(a, 0.3);
        c.fx.text('Z', x + 20, y, '#7a8cff', 26);
        const pet = c.pet(a.petId);
        // 寝息は見ている子だけ、Z 2 つに 1 回。何匹もの寝息が重なると部屋がうるさい
        if (pet && a.petId === c.s.save.current && this.#snore++ % 2) speakAt(c.fx, pet.breed, 'sleep', [x, y]);
      }
    }
    // 見ているだけで拾えるので、何匹いても 1 分に 1 つほどに抑える（おさんぽは道に 3 つ）
    if (c.s.scene !== 'park' || c.view.presents.length >= 1) return;
    this.#presentWait -= dt;
    if (this.#presentWait > 0) return;
    this.#presentWait = 45;
    this.spawnPresent();
  }

  /**
   * 歩いている子の足音と、ソファ・ベッド・床に降りた音。おふろ（たらいの水の音）とおさんぽ（自分で刻む）は鳴らさない。
   * 何匹も歩くと足音がつながってうるさいので、全体で 0.09 秒に 1 歩まで
   */
  #footsteps(a: Actor, dt: number) {
    const c = this.#c;
    const ground = GROUND[c.s.scene];
    const f = this.#feet.get(a) ?? this.#feet.set(a, { step: 0, air: false }).get(a)!;
    if (a.hop) f.air = true;
    else if (f.air) {
      f.air = false;
      sounds.land(a.perch === 'sofa' || a.perch === 'bed' ? 'sofa' : 'floor');
    }
    f.step -= dt;
    if (!ground || a.hop || (a.action !== 'walk' && a.action !== 'run') || f.step > 0) return;
    f.step = a.action === 'run' ? 0.17 : 0.3;
    if (this.#lastStep < 0.09) return;
    this.#lastStep = 0;
    const pet = c.pet(a.petId);
    sounds.step(ground, !!pet && kindOf(pet.breed) === 'cat');
  }

  spawnPresent() {
    const c = this.#c;
    const b = PARK.bounds;
    for (let i = 0; i < 12; i++) {
      const p = {
        x: b.x0 + 0.3 + Math.random() * (b.x1 - b.x0 - 0.6),
        z: b.z0 + 0.4 + Math.random() * (b.z1 - b.z0 - 1.8)
      };
      const clear =
        PARK.blocks.every((k) => Math.hypot(p.x - k.x, p.z - k.z) > k.r + 0.35) &&
        c.actors.every((a) => Math.hypot(p.x - a.x, p.z - a.z) > 1) &&
        c.view.presents.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 1);
      if (!clear) continue;
      c.view.presents.push({ id: ++this.#presentId, ...p });
      return;
    }
  }
}

const GROUND: Partial<Record<Scene, Surface>> = {
  room: 'floor',
  lesson: 'floor',
  park: 'grass',
  plaza: 'grass',
  contest: 'grass'
};
