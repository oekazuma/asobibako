import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';

/** 埋まりすぎた人の場所の印。赤い下向きの円すいを頭の上に浮かべ、深さを見ずに描いて壁を透かして見せる */
export class Markers {
  readonly #scene: THREE.Scene;
  readonly #geo = new THREE.ConeGeometry(0.16, 0.4, 16);
  readonly #mat = new THREE.MeshBasicMaterial({
    color: '#ff3b30',
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false
  });
  readonly #arrows: THREE.Mesh[] = [];
  #t = 0;

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
  }

  /** 頭の位置の並び。揺らすだけで明滅はさせない（大勢の中の点滅はチカチカに見える） */
  set(points: V3[], dt: number): void {
    this.#t += dt;
    while (this.#arrows.length < points.length) {
      const m = new THREE.Mesh(this.#geo, this.#mat);
      m.rotation.x = Math.PI;
      m.renderOrder = 30;
      this.#scene.add(m);
      this.#arrows.push(m);
    }
    this.#arrows.forEach((m, i) => {
      const p = points[i];
      m.visible = !!p;
      if (p) m.position.set(p[0], p[1] + 0.5 + Math.sin(this.#t * 3) * 0.06, p[2]);
    });
  }

  dispose(): void {
    for (const m of this.#arrows) m.removeFromParent();
    this.#geo.dispose();
    this.#mat.dispose();
  }
}
