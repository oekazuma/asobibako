import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { Group, Quaternion, Vector3, type Object3D } from 'three';
import type { Face, Grip, Pose } from './dance';
import { Outfit } from './outfit';
import type { Coord } from './outfits';
import { Rig, type BoneName } from './rig';

/**
 * 3D のアイドル 1 人。かっこうを骨組み（rig.ts）で解き、その骨の向きをモデル（VRM）の骨へ写す。
 * 骨組みは腕と脚を下ろした形、モデルは腕を横へ広げた形（T ポーズ）が基本なので、手足は基本の形の差を足して写す。
 * 髪とスカートの揺れはモデルが持つ揺れもの（spring bone）、表情はモデルの表情（blendshape）で出す
 */

export interface FaceState {
  face: Face;
  /** 歌う口の開き 0..1 */
  mouth: number;
  blink: boolean;
}

/** 骨組みの骨と、モデルの骨。骨組みの R（客席から見て右）はモデルの左 */
const MAP: [BoneName, VRMHumanBoneName][] = [
  ['hips', 'hips'],
  ['spine', 'spine'],
  ['chest', 'chest'],
  ['upperChest', 'upperChest'],
  ['neck', 'neck'],
  ['head', 'head'],
  ['upperR', 'leftUpperArm'],
  ['foreR', 'leftLowerArm'],
  ['handR', 'leftHand'],
  ['upperL', 'rightUpperArm'],
  ['foreL', 'rightLowerArm'],
  ['handL', 'rightHand'],
  ['thighR', 'leftUpperLeg'],
  ['shinR', 'leftLowerLeg'],
  ['footR', 'leftFoot'],
  ['thighL', 'rightUpperLeg'],
  ['shinL', 'rightLowerLeg'],
  ['footL', 'rightFoot']
];

/** 骨の先の向きを測るための、次の骨 */
const NEXT: Partial<Record<VRMHumanBoneName, VRMHumanBoneName>> = {
  leftUpperArm: 'leftLowerArm',
  leftLowerArm: 'leftHand',
  leftHand: 'leftMiddleProximal',
  rightUpperArm: 'rightLowerArm',
  rightLowerArm: 'rightHand',
  rightHand: 'rightMiddleProximal',
  leftUpperLeg: 'leftLowerLeg',
  leftLowerLeg: 'leftFoot',
  rightUpperLeg: 'rightLowerLeg',
  rightLowerLeg: 'rightFoot'
};

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const;
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const;
/** にぎり方ごとの、親指から小指までの曲げ（0 でのばす、1 でにぎる） */
const GRIPS: Record<Grip, number[]> = {
  open: [0.1, 0.1, 0.1, 0.15, 0.2],
  fist: [0.7, 1, 1, 1, 1],
  point: [0.7, 0, 1, 1, 1],
  v: [0.7, 0, 0, 1, 1],
  heart: [0.4, 0.6, 0.6, 0.6, 0.6]
};

/** 客席を向く骨組みの向きを、-z を向くモデルの中の向きへ（y 軸まわりに半回転） */
const HALF = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const HALF_INV = HALF.clone().invert();

export class Idol3D {
  /** 立ち位置と体ごとの向き（骨組みの root）を受け持つ入れ物 */
  readonly group = new Group();
  readonly rig = new Rig();
  readonly vrm: VRM;
  readonly #outfit: Outfit;
  /** モデルの骨の基本の向きの差（手足だけ） */
  readonly #offset = new Map<VRMHumanBoneName, Quaternion>();
  readonly #restHips = new Vector3();
  readonly #rigHips = new Vector3();

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.group.add(vrm.scene);
    this.#outfit = new Outfit(vrm);
    const h = vrm.humanoid;
    const local = (name: VRMHumanBoneName) =>
      vrm.scene.worldToLocal(h.getNormalizedBoneNode(name)!.getWorldPosition(new Vector3()));
    vrm.scene.updateMatrixWorld(true);
    for (const [, name] of MAP) {
      const next = NEXT[name];
      if (!next) continue;
      // モデルの中で、この骨の先がどちらを向いているか。骨組みでは真下
      const dir = local(next).sub(local(name)).normalize();
      this.#offset.set(name, new Quaternion().setFromUnitVectors(dir, new Vector3(0, -1, 0)));
    }
    this.#restHips.copy(h.getNormalizedBoneNode('hips')!.position);
    this.#rigHips.copy(this.rig.bones.hips.position);
  }

  dress(c: Coord): void {
    this.#outfit.wear(c);
  }

  /** 顔と目線を向ける先（カメラ） */
  look(target: Object3D): void {
    if (this.vrm.lookAt) this.vrm.lookAt.target = target;
  }

  pose(p: Pose, face: FaceState, dt: number): void {
    const rig = this.rig;
    rig.apply(p);
    this.group.position.copy(rig.root.position);
    this.group.quaternion.copy(rig.root.quaternion);
    const h = this.vrm.humanoid;
    const rootInv = rig.root.quaternion.clone().invert();
    const world = new Map<VRMHumanBoneName, Quaternion>();
    for (const [bone, name] of MAP) {
      const node = h.getNormalizedBoneNode(name);
      if (!node) continue;
      // 骨組みの向き（root から見た）を、モデルの中の向きへ
      const q = rootInv.clone().multiply(rig.bones[bone].getWorldQuaternion(new Quaternion()));
      const m = HALF.clone().multiply(q).multiply(HALF_INV);
      const off = this.#offset.get(name);
      if (off) m.multiply(off);
      world.set(name, m);
      const parent = parentOf(name);
      const pq = parent ? (world.get(parent) ?? new Quaternion()) : new Quaternion();
      node.quaternion.copy(pq.clone().invert().multiply(m));
    }
    const d = rig.bones.hips.position.clone().sub(this.#rigHips).applyQuaternion(HALF);
    h.getNormalizedBoneNode('hips')!.position.copy(this.#restHips).add(d);
    this.#grip('left', p.gripR);
    this.#grip('right', p.gripL);
    this.#face(face);
    this.vrm.update(dt);
  }

  #grip(side: 'left' | 'right', g: Grip) {
    const h = this.vrm.humanoid;
    GRIPS[g].forEach((curl, i) => {
      for (const j of JOINTS) {
        const node = h.getNormalizedBoneNode(`${side}${FINGERS[i]}${j}` as VRMHumanBoneName);
        if (!node) continue;
        // 手のひらは下向き（T ポーズ）なので、指は z 軸まわりに下へ曲げる。親指は手のひらの前へ寄せる
        const k = side === 'left' ? 1 : -1;
        if (i === 0) node.rotation.set(0, -k * curl * 0.6, k * curl * 0.3);
        else node.rotation.set(0, 0, k * curl * (j === 'Proximal' ? 1.2 : 1.4));
      }
    });
  }

  #face(f: FaceState) {
    const e = this.vrm.expressionManager;
    if (!e) return;
    const set = (name: string, v: number) => e.setValue(name, v);
    for (const n of ['happy', 'relaxed', 'angry', 'blink', 'blinkLeft', 'blinkRight', 'aa']) set(n, 0);
    switch (f.face) {
      case 'happy':
        set('happy', 1);
        break;
      case 'wink':
        set('relaxed', 0.6);
        set('blinkRight', 1);
        break;
      case 'star':
        set('relaxed', 1);
        break;
      case 'focus':
        set('angry', 0.35);
        break;
      case 'sing':
        set('relaxed', 0.4);
        set('blink', 0.85);
        break;
      default:
        set('relaxed', 0.6);
    }
    if (f.blink && (f.face === 'smile' || f.face === 'focus' || f.face === 'star')) set('blink', 1);
    set('aa', Math.min(1, f.mouth * 0.9));
  }
}

const made = new WeakMap<VRM, Idol3D>();
/** モデル 1 つにアイドル 1 人。基本の形はかっこうを当てる前にしか測れないので、作りなおさない */
export const idolFor = (vrm: VRM): Idol3D => made.get(vrm) ?? made.set(vrm, new Idol3D(vrm)).get(vrm)!;

/** モデルの骨の親（写す骨の中で）。肩の骨は動かさないので、腕の親は胸の上 */
function parentOf(name: VRMHumanBoneName): VRMHumanBoneName | null {
  const P: Partial<Record<VRMHumanBoneName, VRMHumanBoneName>> = {
    spine: 'hips',
    chest: 'spine',
    upperChest: 'chest',
    neck: 'upperChest',
    head: 'neck',
    leftUpperArm: 'upperChest',
    leftLowerArm: 'leftUpperArm',
    leftHand: 'leftLowerArm',
    rightUpperArm: 'upperChest',
    rightLowerArm: 'rightUpperArm',
    rightHand: 'rightLowerArm',
    leftUpperLeg: 'hips',
    leftLowerLeg: 'leftUpperLeg',
    leftFoot: 'leftLowerLeg',
    rightUpperLeg: 'hips',
    rightLowerLeg: 'rightUpperLeg',
    rightFoot: 'rightLowerLeg'
  };
  return P[name] ?? null;
}
