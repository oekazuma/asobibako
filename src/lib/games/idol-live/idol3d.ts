import { Group } from 'three';
import { Body } from './body';
import type { Pose } from './dance';
import type { FaceState } from './face-draw';
import { Hair } from './hair';
import { bodyPaint, Outfit } from './outfit';
import type { Coord } from './outfits';
import { Head } from './head';
import { Rig } from './rig';

/** 3D のアイドル 1 人。骨組み・体・頭・髪をまとめ、かっこうと表情を受けて動かす */
export class Idol3D {
  readonly group = new Group();
  readonly rig = new Rig();
  readonly body: Body;
  readonly head = new Head();
  readonly hair: Hair;
  readonly outfit: Outfit;

  constructor() {
    this.body = new Body(this.rig);
    this.hair = new Hair(this.rig);
    this.outfit = new Outfit(this.rig);
    this.rig.bones.head.add(this.head.group, this.hair.head);
    this.group.add(this.rig.root, ...this.body.skinned, ...this.hair.tails);
  }

  dress(c: Coord): void {
    this.outfit.wear(c);
    this.body.paint(bodyPaint(c));
  }

  #last: Pose | null = null;
  #flare = 0;

  pose(p: Pose, face: FaceState, dt: number): void {
    // 回る速さと上下の速さで、スカートをひるがえす
    if (this.#last && dt > 0) {
      const w = Math.abs(p.spin - this.#last.spin) / dt + (Math.abs(p.air - this.#last.air) * 12) / dt;
      this.#flare += (Math.min(1, w / 9) - this.#flare) * Math.min(1, dt * 8);
    }
    this.#last = p;
    this.outfit.flare(this.#flare);
    this.rig.apply(p);
    this.body.grip('L', p.gripL);
    this.body.grip('R', p.gripR);
    this.head.set(face);
    this.hair.update(this.rig, dt);
  }
}
