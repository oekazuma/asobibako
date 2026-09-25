import { playing, throwToy, wandBalls, wandBite } from './behavior';
import { itemName, kindOf } from './engine';
import { clampToFloor } from './layout';
import type { Core, Touch } from './core';
import { sounds } from './sounds';
import { createWand, POM, stepWand, type Wand } from './wand';

const TOY_IDLE = 20;

/** 投げるおもちゃ。はじいて投げ、持ってきたもの・床に残ったものを拾って手元へ戻す */
export class Toys {
  readonly #c: Core;
  /** 床のおもちゃを誰も構わずに置いておいた秒。TOY_IDLE を過ぎると手元へ戻す */
  #idle = 0;

  constructor(core: Core) {
    this.#c = core;
  }

  /** 投げたおもちゃが、咥えられているか動いているか、front から離れた床にある */
  away(): boolean {
    const t = this.#c.view.toy;
    if (!t || t.kind === 'wand') return false;
    const front = this.#c.layout.front;
    return !!t.holder || !t.still || Math.hypot(t.x - front.x, t.z - front.z) > 0.7;
  }

  /** 床に残ったおもちゃ（咥えたまま寝た子のものも）をタップして拾い、手元に戻す */
  pickUp(px: number, py: number): boolean {
    const c = this.#c;
    const t = c.view.toy;
    if (!t || !c.s.away) return false;
    const holder = t.holder ? c.actor(t.holder) : undefined;
    const offered = holder?.mode === 'offer';
    if (t.holder && !holder?.asleep && !offered) return false;
    const [x, y] = c.world.project(t.x, t.y, t.z);
    if (Math.hypot(px - x, py - y) > 60) return false;
    this.#toHand(x, y);
    const pet = holder && c.pet(holder.petId);
    if (!offered || !holder || !pet) return true;
    const [hx, hy] = c.above(holder);
    c.fx.hearts(hx, hy, 4);
    c.fx.text('ありがとう！', hx, hy - 30);
    c.voice(pet, 'happy');
    return true;
  }

  #toHand(x: number, y: number) {
    const c = this.#c;
    const t = c.view.toy;
    const holder = t?.holder ? c.actor(t.holder) : undefined;
    if (holder) holder.carrying = null;
    c.view.toy = null;
    c.s.away = false;
    this.#idle = 0;
    c.fx.sparkle(x, y, 3);
    sounds.pop();
  }

  /** 止まったまま誰も構わない（咥えたまま寝た子のものも）おもちゃは、しばらくするとひとりでに手元へ戻る */
  tick(dt: number) {
    const c = this.#c;
    const t = c.view.toy;
    const holder = t?.holder ? c.actor(t.holder) : undefined;
    const left =
      !!t && t.kind !== 'wand' && (holder ? holder.asleep : t.still) && !c.touches.length && !c.actors.some(playing);
    this.#idle = left ? this.#idle + dt : 0;
    if (!t || this.#idle < TOY_IDLE) return;
    const away = this.away();
    const [x, y] = c.world.project(t.x, t.y, t.z);
    this.#toHand(x, y);
    if (away) c.say(`${itemName(t.kind)}が もどってきたよ`);
  }

  /**
   * はじいた向きは、指の下の床の点と、はじいた先の床の点を結んで決める（画面の上へはじけば奥へ飛ぶ）。
   * 速さは画面の高さに対する指の速さで決め、上へ強くはじくほど遠くへ飛ぶ
   */
  throw(touch: Touch, px: number, py: number, vx: number, vy: number) {
    const c = this.#c;
    const kind = c.s.toy;
    if (kind === 'wand') return;
    const out = c.view.toy;
    if (c.s.away && !c.s.activity && out) {
      if (out.still && !out.holder) return c.say('おもちゃを タップして ひろってね', 2);
      if (out.holder && c.actor(out.holder)?.mode === 'offer')
        return c.say('くちの おもちゃを タップして うけとってね', 2);
      const chaser = c.actors.find((a) => a.mode === 'chase' && this.#isDog(a.petId));
      const pet = c.pet(out.holder ?? chaser?.petId ?? c.s.save.current);
      const dog = pet && kindOf(pet.breed) === 'dog';
      return c.say(dog ? `${pet.name}が もってくるまで まってね` : 'おもちゃが とまるまで まってね', 2);
    }
    const layout = c.layout;
    const rolled = kind === 'mouse';
    const speed = Math.hypot(vx, vy) / c.h;
    if (speed < 0.35) {
      const y = rolled ? 0.03 : 0.3;
      const p = clampToFloor(layout, c.world.floor(px, py) ?? layout.front);
      c.view.toy = throwToy(kind, { x: p.x, y, z: p.z }, { x: 0, y: 0, z: 0 });
      return;
    }
    // 手に持った高さから投げる。指を置いた床の点から出すと、足もとのペットにすぐ当たってしまう
    const from = clampToFloor(layout, c.world.floor(touch.sx, touch.sy) ?? layout.front);
    const at = c.world.floor(px, py);
    const ahead = at && c.world.floor(px + vx * 0.05, py + vy * 0.05);
    let dx = ahead && at ? ahead.x - at.x : vx / (Math.hypot(vx, vy) * 2);
    let dz = ahead && at ? ahead.z - at.z : -1;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // コンテストの会場のような外の場面も、公園と同じだけ遠くへ飛ばせる
    const park = c.s.scene !== 'room';
    const up = Math.max(0, -vy / c.h);
    // カメラが低いので、高く上げると画面の上へ消える。遠くへは横の速さで飛ばす
    const [h, v] =
      kind === 'frisbee'
        ? [Math.min(1 + speed * 1.8, park ? 8 : 5), Math.min(0.4 + up * 0.2, 1.2)]
        : kind === 'ball'
          ? [Math.min(0.8 + speed * 1.5, park ? 7 : 5), Math.min(1 + up * 0.35, park ? 3.2 : 2.3)]
          : [Math.min(speed * 1.4, 3.5), 0];
    const y = rolled ? 0.03 : 0.55;
    c.view.toy = throwToy(kind, { x: from.x, y, z: from.z }, { x: dx * h, y: v, z: dz * h });
    sounds.throw();
  }

  #isDog(petId: string) {
    const pet = this.#c.pet(petId);
    return !!pet && kindOf(pet.breed) === 'dog';
  }
}

/** ねこじゃらし。ふさは指の下の点（tx, ty, tz）を少し遅れて追う */
export class WandHand {
  on = false;
  readonly #c: Core;
  #tx = 0;
  #ty = 0;
  #tz = 0;
  #rig: Wand | null = null;
  /** 持ち上げはじめたときの立てた面の奥行き。寄ってくる子に合わせて動かすと、ふさが手前へ逃げ続ける */
  #plane: number | null = null;
  #rustle = 0;

  constructor(core: Core) {
    this.#c = core;
  }

  /**
   * ふさは指の下の床の点へ運ぶ。指がいまの子のそばで足元より上へ行く（床の点がその子の奥になる）と、
   * その子の顔の前に立てた面の点へぶら下げ、指の高さまで持ち上げる。指が面の手前の床へ戻るまで持ち上げたまま
   */
  aim(px: number, py: number) {
    const c = this.#c;
    const p = c.world.floor(px, py);
    const q = p && clampToFloor(c.layout, p);
    let t = q && { x: q.x, y: 0, z: q.z };
    const a = c.actor();
    if (!this.on) this.#plane = null;
    const plane = this.#plane ?? (a ? clampToFloor(c.layout, { x: a.x, z: a.z + 0.15 }).z : null);
    const lift = plane === null ? null : c.world.upright(px, py, plane);
    const over = !!lift && lift.y > 0;
    if (this.#plane === null && over && a && Math.abs(lift.x - a.x) < 0.3) this.#plane = plane;
    else if (!over) this.#plane = null;
    if (lift && this.#plane !== null) t = { x: lift.x, y: Math.min(lift.y, 0.6), z: lift.z };
    if (!t) return;
    [this.#tx, this.#ty, this.#tz] = [t.x, t.y, t.z];
    if (!this.on) this.#rig = createWand(t);
    this.on = true;
  }

  step(dt: number) {
    const c = this.#c;
    const rig = this.#rig;
    if (!this.on || !rig) {
      c.view.wand = null;
      return;
    }
    stepWand(rig, { x: this.#tx, y: this.#ty, z: this.#tz }, dt, wandBite(c.actors), wandBalls(c.actors));
    const p = rig.nodes[POM];
    c.view.wand = { x: p.x, y: p.y, z: p.z, moving: rig.speed > 0.15, rig };
    this.#rustle -= dt;
    if (rig.speed > 1.2 && this.#rustle <= 0) {
      this.#rustle = 0.22;
      sounds.rustle(Math.min(1, rig.speed / 3));
    }
  }
}
