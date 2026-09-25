import type { Activity, ActivityScene, Visit } from './activity';
import { command, type Actor } from './behavior';
import type { Track } from './bgm';
import type { Core } from './core';
import type { Cry } from './cries';
import type { CounterId, Pet } from './engine';
import type { Tool } from './session.svelte';
import type { BaseScene, ToyId } from './types';

/** 場面の出入りのうち、Session が持っているもの */
export interface Stage {
  enter(target: BaseScene | ActivityScene): void;
  /** 「いどうちゅう」を 1 度描かせてから run する。重ねて呼んだら、あとのほうは捨てる */
  go(label: string, run: () => void): void;
  /** 置いている指・ねこじゃらし・芸の途中をやめる */
  pause(): void;
  /** 部屋へ戻ったあと、いまのペットに合うおもちゃに持ち替えて保存する */
  settle(): void;
  music(track: Track | null): void;
  found(a: Actor): void;
}

/** 遊びのモードの出入り。モードに渡す口（activity.ts の ActivityHost / SceneHost）もここで組む */
export class Modes {
  /** モードが 3D に出している子。あいだは飼っているペットの代わりにこの子たちを描く */
  cast: { pets: Pet[]; actors: Actor[] } | null = null;
  readonly #c: Core;
  readonly #stage: Stage;
  /** モードを始める前の道具。モードがおもちゃを持ち替えても、終わったら戻す */
  #before: { tool: Tool; toy: ToyId } = { tool: 'hand', toy: 'ball' };

  constructor(core: Core, stage: Stage) {
    this.#c = core;
    this.#stage = stage;
  }

  start(activity: Activity, going: string) {
    const c = this.#c;
    const pet = c.s.current;
    if (c.s.activity || !pet) return;
    if (activity.awakeOnly && c.actor()?.asleep) return c.say(`${pet.name}は ねているよ。おきるまで まってね`);
    this.#stage.go(going, () => {
      if (c.s.activity) return;
      this.#pause();
      const a = c.actor();
      if (a) command(a, pet, { type: 'wake' });
      c.s.activity = activity;
      activity.enter(this.#host(pet));
    });
  }

  visit(mode: Visit, going: string) {
    const c = this.#c;
    if (c.s.activity) return;
    this.#stage.go(going, () => {
      if (c.s.activity) return;
      this.#pause();
      c.s.activity = mode;
      mode.enter(this.#host(null));
    });
  }

  #pause() {
    this.#before = { tool: this.#c.s.tool, toy: this.#c.s.toy };
    this.#stage.pause();
  }

  #end(scene: BaseScene = 'room') {
    const c = this.#c;
    const act = c.s.activity;
    if (!act) return;
    c.s.activity = null;
    this.cast = null;
    act.exit?.();
    c.world.trophies = c.s.save.contest;
    c.world.room = c.s.save.room;
    this.#stage.enter(scene);
    c.s.setTool(this.#before.tool, this.#before.toy);
    this.#stage.settle();
  }

  #host<P extends Pet | null>(pet: P) {
    const c = this.#c;
    const stage = this.#stage;
    // view と actor は場面に入るたびに作り直すので、読むたびに今のものを返す
    return {
      save: c.s.save,
      pet,
      get actor() {
        return pet ? c.actor(pet.id) : undefined;
      },
      get view() {
        return c.view;
      },
      fx: c.fx,
      world: c.world,
      get size() {
        return [c.w, c.h] as const;
      },
      enter: (scene: ActivityScene) => stage.enter(scene),
      cast: (pets: Pet[], actors: Actor[]) => void (this.cast = { pets, actors }),
      setTool: (tool: Tool, toy?: ToyId) => c.s.setTool(tool, toy),
      say: (text: string, seconds?: number) => c.say(text, seconds),
      above: (a: Actor, y?: number) => c.above(a, y),
      purse: () => c.purse(),
      voice: (cry?: Cry) => void (pet && c.voice(pet, cry)),
      music: (track: Track | null) => stage.music(track),
      changed: () => c.changed(),
      count: (key: CounterId, n?: number) => c.count(key, n),
      found: (a: Actor) => stage.found(a),
      end: (scene?: BaseScene) =>
        stage.go(scene === 'park' ? 'こうえんへ いくよ' : 'おうちへ かえるよ', () => this.#end(scene))
    };
  }
}
