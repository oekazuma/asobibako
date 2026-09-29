import { Bone, Matrix4, Quaternion, Skeleton, Vector3 } from 'three';
import type { Arm, Foot, Pose } from './dance';

/**
 * アイドルの骨組み（7.5 頭身、背 1.6m）。かっこうを骨の向きに解く。腕と脚は、手と足を置く位置から
 * ひじ・ひざを逆運動学で決める。描かなくても使えるので、譜面のノーツの位置出しとテストでも使う
 */

export const SIZE = {
  hips: 0.86,
  spine: 0.1,
  chest: 0.16,
  neck: 0.15,
  head: 0.06,
  /** 胸の骨から見た肩の付け根 */
  shoulder: new Vector3(0.14, 0.135, -0.01),
  upper: 0.25,
  fore: 0.22,
  hand: 0.075,
  /** 腰の骨から見た股の付け根 */
  hip: new Vector3(0.08, -0.05, 0),
  thigh: 0.4,
  shin: 0.37,
  /** 足首の高さ */
  ankle: 0.055,
  /** ツインテールの節の数と長さ */
  tail: { n: 6, len: 0.085 },
  /** 頭の骨から見たツインテールの根元 */
  tailRoot: new Vector3(0.082, 0.185, -0.035)
};

const SIDES = ['L', 'R'] as const;
export type Side = (typeof SIDES)[number];
/** 客席から見て左が -1 */
export const sign = (s: Side) => (s === 'L' ? -1 : 1);

export type BoneName =
  | 'root'
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | `${'upper' | 'fore' | 'hand' | 'thigh' | 'shin' | 'foot'}${Side}`
  | `tail${Side}${number}`;

const v = new Vector3();
const w = new Vector3();
const q = new Quaternion();
const m = new Matrix4();

export class Rig {
  readonly root = new Bone();
  readonly bones = {} as Record<BoneName, Bone>;
  readonly skeleton: Skeleton;

  constructor() {
    const add = (name: BoneName, parent: Bone, x: number, y: number, z: number) => {
      const b = new Bone();
      b.name = name;
      b.position.set(x, y, z);
      parent.add(b);
      this.bones[name] = b;
      return b;
    };
    this.root.name = 'root';
    this.bones.root = this.root;
    const hips = add('hips', this.root, 0, SIZE.hips, 0);
    const spine = add('spine', hips, 0, SIZE.spine, 0);
    const chest = add('chest', spine, 0, SIZE.chest, 0);
    const neck = add('neck', chest, 0, SIZE.neck, 0);
    const head = add('head', neck, 0, SIZE.head, 0);
    for (const s of SIDES) {
      const k = sign(s);
      const upper = add(`upper${s}`, chest, k * SIZE.shoulder.x, SIZE.shoulder.y, SIZE.shoulder.z);
      const fore = add(`fore${s}`, upper, 0, -SIZE.upper, 0);
      add(`hand${s}`, fore, 0, -SIZE.fore, 0);
      const thigh = add(`thigh${s}`, hips, k * SIZE.hip.x, SIZE.hip.y, SIZE.hip.z);
      const shin = add(`shin${s}`, thigh, 0, -SIZE.thigh, 0);
      add(`foot${s}`, shin, 0, -SIZE.shin, 0);
      let t = add(`tail${s}0`, head, k * SIZE.tailRoot.x, SIZE.tailRoot.y, SIZE.tailRoot.z);
      for (let i = 1; i < SIZE.tail.n; i++) t = add(`tail${s}${i}`, t, 0, -SIZE.tail.len, 0);
    }
    this.root.updateMatrixWorld(true);
    this.skeleton = new Skeleton(Object.values(this.bones));
  }

  /** かっこうを骨に当てる。ツインテールの骨は触らない（揺れは hair.ts が付ける） */
  apply(p: Pose): void {
    const b = this.bones;
    this.root.position.set(p.x, 0, p.z);
    this.root.quaternion.setFromAxisAngle(w.set(0, 1, 0), p.spin);
    b.hips.position.set(0, SIZE.hips - p.crouch + p.air, 0);
    euler(b.hips, 0, p.twist * 0.25, -p.lean * 0.3);
    euler(b.spine, p.bow * 0.5, p.twist * 0.35, -p.lean * 0.35);
    euler(b.chest, p.bow * 0.5, p.twist * 0.4, -p.lean * 0.35);
    euler(b.neck, p.nod * 0.3, p.turn * 0.35, -p.tilt * 0.3);
    euler(b.head, p.nod * 0.7, p.turn * 0.65, -p.tilt * 0.7);
    this.root.updateMatrixWorld(true);
    for (const s of SIDES) {
      this.#arm(s, s === 'L' ? p.armL : p.armR);
      this.#leg(s, s === 'L' ? p.footL : p.footR, p.air);
    }
  }

  /** 骨の世界の位置 */
  at(name: BoneName, out = new Vector3()): Vector3 {
    return this.bones[name].getWorldPosition(out);
  }

  /** 手の先を reach だけ伸ばした点（ノーツを置く所） */
  tip(s: Side, reach: number, out = new Vector3()): Vector3 {
    const hand = this.at(`hand${s}`, out);
    const dir = w.copy(hand).sub(this.at(`fore${s}`, v)).normalize();
    return hand.addScaledVector(dir, reach);
  }

  #arm(s: Side, a: Arm) {
    const k = sign(s);
    const chest = this.bones.chest;
    const upper = this.bones[`upper${s}`];
    const S = upper.getWorldPosition(new Vector3());
    const L = SIZE.upper + SIZE.fore;
    // 胸の骨の向きで、肩から手への向きを決める
    const dir = new Vector3(k * Math.sin(a.a) * Math.cos(a.f), -Math.cos(a.a) * Math.cos(a.f), Math.sin(a.f));
    dir.transformDirection(chest.matrixWorld);
    const T = S.clone().addScaledVector(dir, L * Math.max(0.3, Math.min(0.999, a.r)));
    // ひじは外うしろへ逃がす
    const pole = new Vector3(k * 0.7, -0.3, -0.8).transformDirection(chest.matrixWorld);
    const E = bend(S, T, SIZE.upper, SIZE.fore, pole);
    const up = E.clone().sub(S);
    const out = T.clone().sub(E);
    // ひじは前へ曲がる。上腕の +z は前腕の向く側、前腕の +z は肩の側。伸びきっているときは、ひじと反対の側を前にする
    const front = pole.clone().negate();
    aim(upper, up, out, front);
    const z = aim(this.bones[`fore${s}`], out, up.clone().negate(), upper.getWorldDirection(new Vector3()));
    aim(this.bones[`hand${s}`], out, z, z);
  }

  #leg(s: Side, f: Foot, air: number) {
    const k = sign(s);
    const thigh = this.bones[`thigh${s}`];
    const H = thigh.getWorldPosition(new Vector3());
    const T = new Vector3(k * (SIZE.hip.x + f.x), SIZE.ankle + f.lift + air, f.z);
    T.applyMatrix4(this.root.matrixWorld);
    // ひざは前へ、少し外へ
    const pole = new Vector3(k * 0.25, 0, 1).transformDirection(this.root.matrixWorld);
    const K = bend(H, T, SIZE.thigh, SIZE.shin, pole);
    const low = T.clone().sub(K);
    aim(thigh, K.clone().sub(H), pole, pole);
    aim(this.bones[`shin${s}`], low, pole, pole);
    // 足の裏は床に平ら。上げた足だけつま先を少し下げる
    const foot = this.bones[`foot${s}`];
    q.setFromAxisAngle(w.set(1, 0, 0), f.lift * 2.5);
    const world = this.root.getWorldQuaternion(new Quaternion()).multiply(q);
    foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    foot.updateMatrixWorld(true);
  }
}

function euler(b: Bone, x: number, y: number, z: number) {
  b.rotation.set(x, y, z, 'YXZ');
}

/** 2 本の骨で S から T へ届くひじ（ひざ）の位置。届かないときは伸ばしきる */
function bend(S: Vector3, T: Vector3, a: number, b: number, pole: Vector3): Vector3 {
  const d = T.clone().sub(S);
  const len = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-4, d.length()));
  const dir = d.normalize();
  T.copy(S).addScaledVector(dir, len);
  const x = (a * a - b * b + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (side.lengthSq() < 1e-8) side.set(0, 0, 1);
  side.normalize();
  return S.clone().addScaledVector(dir, x).addScaledVector(side, h);
}

/**
 * 骨の -y を down の向きに、+z を front に近い向きにする（世界の向きで渡す）。front が down とほぼ重なるときは fallback を使う。
 * 決めた +z の向きを返す
 */
export function aim(bone: Bone, down: Vector3, front: Vector3, fallback: Vector3): Vector3 {
  const y = v.copy(down).normalize().negate();
  const z = w.copy(front).addScaledVector(y, -front.dot(y));
  if (z.lengthSq() < 1e-6) z.copy(fallback).addScaledVector(y, -fallback.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = new Vector3().crossVectors(y, z);
  m.makeBasis(x, y, z);
  q.setFromRotationMatrix(m);
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));
  bone.updateMatrixWorld(true);
  return z.clone();
}
