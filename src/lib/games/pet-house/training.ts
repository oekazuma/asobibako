import { command, type Actor } from './behavior';
import { kindOf, praise, TRICK_REWARD, TRICKS, trickChance, trickName, type Pet } from './engine';
import type { Core } from './core';
import { sounds } from './sounds';
import type { TrickId } from './types';

/** 芸。ボタンでさせて、なでるか声でほめる。リズムあそび（rhythm-play.svelte.ts）の成績もここでほめる */
export class Training {
  readonly #c: Core;

  constructor(core: Core) {
    this.#c = core;
  }

  trick(trick: TrickId) {
    const c = this.#c;
    const pet = c.s.current;
    const a = c.actor();
    if (!pet || !a) return;
    if (a.asleep || a.carrying || a.mode === 'eat' || a.mode === 'drink') return c.say('いまは できないみたい');
    const success = Math.random() < trickChance(pet, trick);
    command(a, pet, { type: 'trick', trick, success });
    const [x, y] = c.above(a);
    if (success) {
      c.s.trickPending = { petId: pet.id, trick, until: c.now + 4 };
      c.fx.sparkle(x, y, 4);
      c.say('できた！ すぐに なでて ほめて あげよう');
    } else {
      c.s.trickPending = null;
      c.fx.text('？', x, y, '#1f9bff', 44);
      c.say('うまく できなかった。もう いちど');
    }
  }

  /** amount は進む覚えた回数 */
  praise(pet: Pet, a: Actor, trick: TrickId, amount = 1) {
    const c = this.#c;
    c.s.trickPending = null;
    const [x, y] = c.above(a);
    const { learned } = praise(pet, trick, amount);
    c.fx.hearts(x, y, 5);
    if (!learned) {
      c.fx.text('いいこ！', x, y - 30);
      sounds.sparkle();
      return;
    }
    c.s.save.money += TRICK_REWARD;
    const t = TRICKS.find((k) => k.id === trick);
    const name = t ? trickName(t, kindOf(pet.breed)) : '';
    c.say(`「${name}」を おぼえた！ +${TRICK_REWARD}コイン`, 4);
    c.fx.confetti(x, y);
    c.fx.coins(x, y, c.purse(), 6);
    sounds.learned();
  }
}
