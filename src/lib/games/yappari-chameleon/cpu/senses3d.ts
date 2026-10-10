import * as THREE from 'three';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from '../doll';
import { bakePose, type DollRig } from '../doll3d';
import type { Me } from '../net';
import { placement } from '../shots';
import type { World } from '../world3d';
import type { Paint, Senses, SurfacePoint } from './senses';

/** CPU の目の絵の大きさ（画素） */
const SIZE = 96;
/**
 * 絵の半分の高さ（m、体の真ん中の距離で測る）。背の高さが絵の高さのおよそ 9 割に収まる。
 * 遠い体も同じ細かさで比べ、遠さは頭脳が別に数える
 */
const FRAME = HEIGHT / 2 / 0.9;
/** 最後に描いてからこれだけたった 3D は古い（縦持ちで描くのを止めている）ので答えない */
const STALE_MS = 250;
/** 体の点は三角形の角ごとに並び、隣どうしが同じ点なので、間引いて渡す */
const STRIDE = 3;

/** 親の端末の 3D で、CPU の頭脳に目立ち・面の色・体の表面を答える */
export class Senses3d implements Senses {
  readonly #world: World;
  readonly #rigOf: (seat: Seat) => DollRig | null;
  readonly #rt = new THREE.WebGLRenderTarget(SIZE, SIZE);
  readonly #cam = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  readonly #with = new Uint8Array(SIZE * SIZE * 4);
  readonly #without = new Uint8Array(SIZE * SIZE * 4);

  constructor(world: World, rigOf: (seat: Seat) => DollRig | null) {
    this.#world = world;
    this.#rigOf = rigOf;
    // 画面と同じく sRGB で比べる（色の違いの閾値を、見た目の違いに合わせる）
    this.#rt.texture.colorSpace = THREE.SRGBColorSpace;
  }

  #fresh(): boolean {
    return performance.now() - this.#world.renderedAt < STALE_MS;
  }

  visible(seat: Seat, by: Seat, eye: V3, at: V3, diff: number): number | null {
    const rig = this.#rigOf(seat);
    if (!this.#fresh() || !rig?.root.visible) return null;
    const cam = this.#cam;
    const far = Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]);
    cam.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(FRAME / Math.max(far, 0.1))), 4, 72);
    cam.updateProjectionMatrix();
    cam.position.set(...eye);
    cam.lookAt(...at);
    cam.updateMatrixWorld();
    // 見ている CPU 自身の体（目の高さに頭と銃がある）は描かない
    const self = this.#rigOf(by);
    const shown = self?.root.visible ?? false;
    if (self) self.root.visible = false;
    this.#world.look(cam, this.#rt, this.#with);
    rig.root.visible = false;
    this.#world.look(cam, this.#rt, this.#without);
    rig.root.visible = true;
    if (self) self.root.visible = shown;
    const k = 255 * diff;
    const a = this.#with;
    const b = this.#without;
    let n = 0;
    for (let i = 0; i < a.length; i += 4)
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > k) n++;
    return n / (SIZE * SIZE);
  }

  colorAt(o: V3, d: V3): Paint | null {
    return this.#world.pickStage(o, d);
  }

  surface(seat: Seat, body: Me): SurfacePoint[] | null {
    const rig = this.#rigOf(seat);
    if (!this.#fresh() || !rig?.root.visible) return null;
    const want = placement(body).at;
    const p = rig.root.position;
    if (Math.hypot(p.x - want[0], p.y - want[1], p.z - want[2]) > 0.01) return null;
    bakePose(rig);
    const baked = rig.pick.geometry.attributes.position;
    const rest = rig.mesh.geometry.attributes.position;
    const nrm = rig.mesh.geometry.attributes.normal;
    const m = rig.mesh.matrixWorld;
    const v = new THREE.Vector3();
    const out: SurfacePoint[] = [];
    for (let i = 0; i < baked.count; i += STRIDE) {
      v.fromBufferAttribute(baked, i).applyMatrix4(m);
      out.push({
        rest: [rest.getX(i), rest.getY(i), rest.getZ(i)],
        normal: [nrm.getX(i), nrm.getY(i), nrm.getZ(i)],
        world: [v.x, v.y, v.z]
      });
    }
    return out;
  }

  dispose(): void {
    this.#rt.dispose();
  }
}
