import { command } from './behavior';
import { speakAt } from './cries';
import { brush, kindOf, stroke } from './engine';
import { dislikes, PART_NAME, strokeWeight, TRY, type Part } from './petting';
import type { Core, Touch } from './core';
import { sounds } from './sounds';
import type { Training } from './training';

/** 指でなでる・ブラシ。指の下の体の場所を追い、なでた分だけなかよしときれいさを上げる */
export class Rubbing {
  /** 開いてから 1 度でもなでたか。まだなら何をすればいいかをヒントに出す */
  stroked = false;
  readonly #c: Core;
  readonly #training: Training;
  /** なで方のヒントを出した回数と、この回に好きな所としてなでた場所 */
  #tips = 0;
  #felt: Part[] = [];
  #timers = { heart: 0, purr: 0, bark: 2, sparkle: 0, tip: 20 };

  constructor(core: Core, training: Training) {
    this.#c = core;
    this.#training = training;
  }

  /** 指が d だけ動いた。床から指をすべらせてペットに乗ったら、そこからなではじめる */
  move(touch: Touch, d: number) {
    const hit = this.#c.world.pickPart(touch.x, touch.y);
    if (touch.mode === 'floor' && hit && touch.moved > 20) {
      touch.mode = 'rub';
      touch.pet = hit.id;
    }
    if (touch.mode === 'rub' && hit?.id === touch.pet) {
      touch.rub += d;
      // 場所の境目の上で指を往復させても、なで続けた秒が切れないよう、別の場所をしばらくなでてから移る
      touch.stray = hit.part === touch.part ? 0 : touch.stray + d;
      if (!touch.part || touch.stray > this.#c.h * 0.04) [touch.part, touch.stray] = [hit.part, 0];
    }
  }

  /** このフレームに指がペットの上で動いた距離だけ効く */
  tick(dt: number) {
    const c = this.#c;
    const t = this.#timers;
    for (const k of ['heart', 'purr', 'bark', 'sparkle', 'tip'] as const) t[k] -= dt;
    if (t.tip <= 0) this.#tip();
    for (const touch of c.touches) {
      if (touch.mode !== 'rub' || !touch.pet) continue;
      const pet = c.pet(touch.pet);
      const a = c.actor(touch.pet);
      const brushing = c.s.tool === 'brush';
      if (brushing) c.world.setBrush(this.#brushAt(touch));
      const amount = Math.min(touch.rub / (c.h * 0.3), dt * 2);
      touch.rub = 0;
      if (!pet || !a || a.asleep || amount <= 0) continue;
      const at = c.world.floor(touch.x, touch.y, a.y + 0.25) ?? undefined;
      command(a, pet, brushing ? { type: 'brush' } : { type: 'stroke', part: touch.part ?? undefined, amount, at });
      c.changed();
      if (brushing) {
        const was = pet.stats.clean;
        brush(pet, amount);
        if (t.sparkle <= 0) {
          t.sparkle = 0.18;
          c.fx.sparkle(touch.x, touch.y);
        }
        // 遊んでいるあいだの減りで 99.9 になっただけのときは出さない（こするたびに出てしまう）
        if (was < 95 && pet.stats.clean >= 100) {
          const [x, y] = c.above(a);
          c.fx.text('ぴかぴか！', x, y, '#1f9bff', 36);
          sounds.sparkle();
        }
        continue;
      }
      if (a.shy > 0) continue;
      const kind = kindOf(pet.breed);
      const part = a.rub?.part ?? touch.part;
      const weight = part ? strokeWeight(kind, pet.love, part, a.rub?.s ?? 0) : 1;
      stroke(pet, amount, weight);
      this.stroked = true;
      if (part && weight > 0 && !this.#felt.includes(part)) this.#felt.push(part);
      if (weight > 0 && t.heart <= 0) {
        // 好きな所ほど、なかよしが多いほど、ハートがよく出る
        t.heart = 0.22 / Math.min(2, weight * (1 + 0.1 * Math.floor(pet.love)));
        // 顔の上に出すと、目を細めているのが隠れる
        const face = part === 'head' || part === 'chin' || part === 'cheek';
        c.fx.hearts(touch.x, touch.y - (face ? 80 : 20));
      }
      const cat = kind === 'cat';
      if (cat && weight > 0 && t.purr <= 0) {
        t.purr = part === 'chin' || part === 'cheek' ? 0.7 : 1.05;
        speakAt(c.fx, pet.breed, 'purr', c.above(a));
      }
      if (weight > 0 && t.bark <= 0) {
        t.bark = cat ? 5 + Math.random() * 4 : 2.5 + Math.random() * 2;
        if (Math.random() < 0.5) {
          c.voice(pet, cat ? 'sweet' : 'happy');
          c.fx.note(...c.above(a));
        }
      }
      const pending = c.s.trickPending;
      if (pending?.petId === pet.id) this.#training.praise(pet, a, pending.trick);
    }
  }

  /** なで方の発見をうながす。1 度なでたあと、まだなでていない好きな所があれば、最初の数回だけ出す */
  #tip() {
    const c = this.#c;
    this.#timers.tip = 35;
    const pet = c.s.current;
    if (!pet || !this.stroked || this.#tips >= 3 || c.s.activity || c.s.trying || c.s.teaching || c.s.toast) return;
    const kind = kindOf(pet.breed);
    const part = TRY[kind].find((p) => !this.#felt.includes(p) && !dislikes(kind, pet.love, p));
    if (!part) return;
    this.#tips++;
    c.say(`${PART_NAME[part]}を なでてみよう`, 4);
  }

  #brushAt(touch: Touch) {
    const y = 0.26 + (touch.pet ? (this.#c.actor(touch.pet)?.y ?? 0) : 0);
    const p = this.#c.world.floor(touch.x, touch.y, y);
    return p && { x: p.x, y, z: p.z };
  }
}
