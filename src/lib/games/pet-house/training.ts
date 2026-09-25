import { command, type Actor } from './behavior';
import { kindOf, praise, TRICK_REWARD, TRICKS, trickChance, trickName, type Pet } from './engine';
import type { Part } from './petting';
import type { Core, Touch } from './core';
import { sounds } from './sounds';
import { done, drawHint, LESSONS, stroke as startStroke, track, type Stroke } from './teach';
import type { TrickId } from './types';
import { bodyMarks } from './world3d';

/** 芸。ボタンでさせる・なでるか声でほめる・体で教える（指で体をそのかっこうへ導く） */
export class Training {
  readonly #c: Core;
  /** 教えている指。lesson が 'done' になったら、同じ指ではもう数えない */
  #lesson: { touch: Touch; stroke: Stroke; lesson: TrickId | 'done' } | null = null;

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

  praise(pet: Pet, a: Actor, trick: TrickId) {
    const c = this.#c;
    c.s.trickPending = null;
    const [x, y] = c.above(a);
    const { learned } = praise(pet, trick);
    c.fx.hearts(x, y, 5);
    if (!learned) {
      c.fx.text('いいこ！', x, y - 30);
      sounds.sparkle();
      return;
    }
    c.s.save.money += TRICK_REWARD;
    if (c.s.teaching === trick) c.s.teaching = null;
    const t = TRICKS.find((k) => k.id === trick);
    const name = t ? trickName(t, kindOf(pet.breed)) : '';
    c.say(`「${name}」を おぼえた！ +${TRICK_REWARD}コイン`, 4);
    c.fx.confetti(x, y);
    c.fx.coins(x, y, c.purse(), 6);
    sounds.learned();
  }

  /** 声で「いいこ」とほめたとき。芸の直後なら、なでてほめたのと同じに数える */
  cheer() {
    const c = this.#c;
    const pet = c.s.current;
    const a = c.actor();
    if (!pet || !a) return;
    const pending = c.s.trickPending;
    if (pending?.petId === pet.id) return this.praise(pet, a, pending.trick);
    c.fx.hearts(...c.above(a), 2);
    c.voice(pet, 'happy');
  }

  /** 芸を体で教えはじめる。null でやめる */
  teach(trick: TrickId | null) {
    const c = this.#c;
    this.#lesson = null;
    const pet = c.s.current;
    const a = c.actor();
    if (!trick || !pet || !a || c.s.activity) return void (c.s.teaching = null);
    if (a.asleep || a.carrying || a.mode === 'eat' || a.mode === 'drink') return c.say('いまは できないみたい');
    c.s.teaching = trick;
    c.s.trickPending = null;
    c.s.setTool('hand');
    command(a, pet, { type: 'teach' });
  }

  /** 教えるあいだはその場で待たせる。寝てしまったらやめる */
  tick() {
    const c = this.#c;
    const trick = c.s.teaching;
    if (!trick) return;
    const pet = c.s.current;
    const a = c.actor();
    if (!pet || !a || a.asleep) return void (c.s.teaching = null);
    const l = this.#lesson;
    if (l && l.lesson !== 'done' && LESSONS[trick].motion === 'hold') this.move(l.touch);
    if (a.mode !== 'act' && a.mode !== 'held' && a.mode !== 'hop' && !c.s.trickPending)
      command(a, pet, { type: 'teach' });
  }

  /** 案内の場所に指を置いたら、なでるかわりに教える指にする */
  down(touch: Touch): boolean {
    const c = this.#c;
    const trick = c.s.teaching;
    if (!trick || c.s.tool !== 'hand' || c.s.trickPending) return false;
    const hit = c.world.pickPart(touch.x, touch.y);
    if (!hit || hit.id !== c.s.save.current || !LESSONS[trick].parts.includes(hit.part)) return false;
    touch.mode = 'teach';
    this.#lesson = { touch, stroke: startStroke(touch.x, touch.y, c.now), lesson: trick };
    this.move(touch);
    return true;
  }

  move(touch: Touch) {
    const c = this.#c;
    const l = this.#lesson;
    const pet = c.s.current;
    const a = c.actor();
    if (!l || l.touch !== touch || l.lesson === 'done' || !pet || !a) return;
    track(l.stroke, touch.x, touch.y);
    const at = this.#partAt(pet.id, LESSONS[l.lesson].parts[0]);
    if (!done(LESSONS[l.lesson], l.stroke, c.now, at?.unit ?? 120)) return;
    // 体をそのかっこうへ導いたので、ボタンとちがって必ずできる
    const trick = l.lesson;
    l.lesson = 'done';
    command(a, pet, { type: 'trick', trick, success: true });
    c.s.trickPending = { petId: pet.id, trick, until: c.now + 4 };
    c.fx.sparkle(...c.above(a), 4);
    sounds.sparkle();
    c.say('できた！ ゆびを はなして なでて ほめて あげよう');
  }

  /** 指を離した */
  release(touch: Touch) {
    if (this.#lesson?.touch === touch) this.#lesson = null;
  }

  /** 体の場所の画面の位置と、画面でのペットの大きさの目安（ピクセル）。案内の印を置く */
  #partAt(petId: string, part: Part) {
    const world = this.#c.world;
    const group = world.model(petId)?.group;
    if (!group) return null;
    group.updateMatrixWorld(true);
    const mark = bodyMarks(group).find((m) => m.part === part);
    if (!mark) return null;
    const [x, y, k] = world.project(mark.at.x, mark.at.y, mark.at.z);
    return { x, y, unit: k * 0.3 };
  }

  draw(ctx: CanvasRenderingContext2D) {
    const c = this.#c;
    const trick = c.s.teaching;
    const pet = c.s.current;
    const a = c.actor();
    // 横を向いて待っているあいだだけ出す。芸のあとカメラを向いているあいだは、印が体の別の所に重なる
    if (!trick || !pet || c.s.trickPending || c.s.activity || a?.mode !== 'act' || !a.side) return;
    const l = LESSONS[trick];
    const at = this.#partAt(pet.id, l.parts[0]);
    if (at) drawHint(ctx, l, at.x, at.y, c.now, at.unit);
  }
}
