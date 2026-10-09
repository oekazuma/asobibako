import * as THREE from 'three';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { PoseAnimator, type DollRig } from './doll3d';
import { Glow, type Shine } from './glow';
import { brushModel, disposeModel, gunModel, inHand } from './gun';
import { DELAY_MS, lerpMe, splice, unpackDabs, type Me } from './net';
import type { Dab } from './paint';
import { poseById } from './poses';
import { placeRoot } from './world3d';

/** 体の根元から頭の上（名前の札を出す所）までの高さ */
export const HEAD_Y = 1.35;

export interface Show {
  /** 答え合わせで、撃たれたときの体をその場に戻して見せる */
  pin: Me | null;
  visible: boolean;
  /** ハンターとして銃を構える */
  armed: boolean;
  shine: Shine;
}

/**
 * ほかの人の体。届いた動きを送った時刻から少し遅らせてつなぎ、その人の吹き付けの列を自分の端末の塗りの面で塗り直す
 */
export class Remote {
  readonly line = new Timeline<Me>();
  readonly log: Dab[] = [];
  readonly rig: DollRig;
  /** 今置いている体の様子。まだ動きが届いていなければ null */
  shown: Me | null = null;
  readonly #poses: PoseAnimator;
  readonly #glow: Glow;
  readonly #gun = gunModel();
  readonly #brush = brushModel();
  #pose = '';

  constructor(rig: DollRig, scene: THREE.Scene) {
    this.rig = rig;
    this.#poses = new PoseAnimator(rig);
    this.#glow = new Glow(rig);
    inHand(rig.bones['forearm.r'], this.#brush, 'brush');
    inHand(rig.bones['forearm.r'], this.#gun, 'gun');
    rig.root.visible = false;
    scene.add(rig.root);
  }

  push(me: Me, now: number): void {
    this.line.push(me.ms, now, me);
  }

  dabs(at: number, d: number[]): void {
    const add = unpackDabs(d);
    const how = splice(this.log, at, add);
    if (how === 'rebuild') this.rig.paint.rebuild(this.log);
    else if (how === 'append') this.rig.paint.apply(add);
  }

  clearPaint(): void {
    this.log.length = 0;
    this.rig.paint.rebuild([]);
  }

  update(dt: number, now: number, show: Show): void {
    const s = this.line.at(now, DELAY_MS);
    const me = show.pin ?? (s ? lerpMe(s.a, s.b, s.t) : null);
    this.shown = me;
    this.rig.root.visible = !!me && show.visible;
    this.#glow.set(this.rig.root.visible ? show.shine : null);
    if (!me) return;
    placeRoot(this.rig.root, me);
    if (me.pose !== this.#pose) {
      // 初めて見えたときはポーズの途中から動かさない
      if (this.#pose) this.#poses.to(poseById(me.pose));
      else this.#poses.snap(poseById(me.pose));
      this.#pose = me.pose;
    }
    this.#gun.visible = show.armed;
    this.#brush.visible = me.paint && !show.armed;
    this.#poses.step(dt);
    this.rig.paint.flush();
  }

  /** 体の真ん中（観戦で見る所・砕ける所）。天井では寝ているので、根元から体の軸に沿って測る */
  center(): V3 | null {
    return this.#above(0.6);
  }

  head(): V3 | null {
    return this.#above(HEAD_Y);
  }

  #above(y: number): V3 | null {
    if (!this.shown) return null;
    const c = this.rig.root.localToWorld(new THREE.Vector3(0, y, 0));
    return [c.x, c.y, c.z];
  }

  colors(): RGB[] {
    return paintColors(this.log);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.#glow.dispose();
    disposeModel(this.#gun);
    disposeModel(this.#brush);
    this.rig.mesh.geometry.dispose();
    this.rig.mesh.skeleton.dispose();
    this.rig.pick.geometry.dispose();
    this.rig.material.dispose();
    this.rig.paint.dispose();
  }
}

/** 砕けた破片の色。塗った量が多いほど塗りの色が増え、少なければ白が多い */
export function paintColors(log: readonly Dab[], n = 20): RGB[] {
  const share = Math.min(1, log.length / 2000);
  return Array.from({ length: n }, (_, i) =>
    log.length && (i + 0.5) / n < share ? log[Math.floor(((i * 7919) % n) * (log.length / n))].c : [1, 1, 1]
  );
}
