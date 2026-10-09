import * as THREE from 'three';
import type { DollRig } from './doll3d';

export type Shine = 'red' | 'blue' | null;

const COLORS = { red: '#ff3b30', blue: '#2f7bff' };

/**
 * 答え合わせで体を光らせる。見つかっていない人は赤、見つかった人は青。
 * 外へ少し膨らませた裏面（ふち）と、壁より奥にあるところだけを描く影（壁を透かした体）の 2 枚で、骨は体と同じものを使う
 */
export class Glow {
  readonly #rim: THREE.SkinnedMesh;
  readonly #ghost: THREE.SkinnedMesh;
  readonly #rimMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  readonly #ghostMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    // 手前の物に隠れたところだけを描く。見えているところは体そのものを見せる
    depthFunc: THREE.GreaterDepth,
    stencilWrite: true,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: 1
  });

  constructor(rig: DollRig) {
    // 見えている体が自分で印を付け、影は印のないところだけを描く。腕が胸の前に重なるところまで色で染めないため
    Object.assign(rig.material, {
      stencilWrite: true,
      stencilRef: 1,
      stencilZPass: THREE.ReplaceStencilOp
    });
    this.#rimMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * 0.025;'
      );
    };
    this.#rim = this.#mesh(rig, this.#rimMat);
    this.#ghost = this.#mesh(rig, this.#ghostMat);
    this.#ghost.renderOrder = 20;
  }

  #mesh(rig: DollRig, m: THREE.Material): THREE.SkinnedMesh {
    const o = new THREE.SkinnedMesh(rig.mesh.geometry, m);
    o.bind(rig.mesh.skeleton, rig.mesh.bindMatrix);
    o.frustumCulled = false;
    o.visible = false;
    rig.root.add(o);
    return o;
  }

  set(kind: Shine): void {
    this.#rim.visible = this.#ghost.visible = kind !== null;
    if (!kind) return;
    this.#rimMat.color.set(COLORS[kind]);
    this.#ghostMat.color.set(COLORS[kind]);
  }

  dispose(): void {
    this.#rim.removeFromParent();
    this.#ghost.removeFromParent();
    this.#rimMat.dispose();
    this.#ghostMat.dispose();
  }
}
