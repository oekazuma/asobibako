import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
  type MeshBasicMaterial,
  type ShaderMaterial,
  type Texture
} from 'three';
import type { Face, Pose } from './dance';
import type { FaceState, Idol3D } from './idol3d';
import type { Coord } from './outfits';
import { Stage3D, type StageState } from './stage3d';

/**
 * 3D を描く口。WebGL の描き手は 1 つだけ作って、じゅんびの画面とライブで使い回す
 * （iOS は開ける WebGL の数が少なく、ライブのたびに作ると足りなくなる）。描き手の canvas は、いま見せる画面へ差しかえる
 */

let shared: WebGLRenderer | null = null;

export function renderer(): WebGLRenderer {
  if (shared) return shared;
  shared = new WebGLRenderer({ antialias: true, alpha: true });
  // 遊ぶ端末（iPad Air 2025）の力に合わせた固定値。それより低い devicePixelRatio の端末はそのまま使う
  shared.setPixelRatio(Math.min(1.5, devicePixelRatio));
  // アニメ塗りの淡い色をにごらせないよう、色の圧縮（トーンマッピング）はしない
  shared.toneMapping = NoToneMapping;
  shared.outputColorSpace = SRGBColorSpace;
  return shared;
}

/** canvas を el の中に入れ、el の大きさに合わせる。戻り値で外す */
export function mount(el: HTMLElement): () => void {
  const r = renderer();
  const c = r.domElement;
  el.prepend(c);
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  return () => {
    if (c.parentElement === el) c.remove();
  };
}

/** 瞬きの間合い。2〜5 秒ごとに 0.12 秒 */
export class Blink {
  #next = 2;
  #left = 0;
  step(dt: number): boolean {
    this.#next -= dt;
    if (this.#next < 0) [this.#left, this.#next] = [0.12, 2 + Math.random() * 3];
    this.#left = Math.max(0, this.#left - dt);
    return this.#left > 0;
  }
}

/** アイドルを照らす光。モデルの材質（MToon）はこの光でアニメ塗りの明暗を決める */
export function lights(scene: Scene): void {
  const key = new DirectionalLight('#ffffff', 2.2);
  key.position.set(0.6, 2.2, 2.4);
  scene.add(key, new AmbientLight('#ffffff', 0.9));
}

/** ライブの場面。ステージとアイドルとカメラ。アイドルは読みこんだ 1 人を使い回す */
export class LiveView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(34, 1, 0.05, 60);
  readonly idol: Idol3D;
  readonly stage = new Stage3D();
  readonly #blink = new Blink();

  constructor(idol: Idol3D, coord: Coord) {
    this.idol = idol;
    idol.dress(coord);
    idol.look(this.camera);
    this.scene.add(this.stage.group, idol.group);
    lights(this.scene);
  }

  /** かっこう・表情・ステージを進める。カメラは呼ぶ側が this.camera に当ててから render する */
  update(p: Pose, face: Face, mouth: number, s: StageState, dt: number): void {
    const f: FaceState = { face, mouth, blink: this.#blink.step(dt) };
    this.idol.pose(p, f, dt);
    this.stage.update(s);
  }

  render(w: number, h: number): void {
    draw(this.scene, this.camera, w, h);
  }

  /** ステージを GPU から外す。アイドルは次のライブでも使うので、先に外しておく */
  dispose(): void {
    if (this.idol.group.parent === this.scene) this.scene.remove(this.idol.group);
    free(this.scene);
  }
}

/** 形・材質・絵を GPU から外す。材質は衣装どうしで使い回しているので、次に使うときにまた作られる */
export function free(scene: Scene): void {
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    for (const m of ([] as Material[]).concat(o.material)) {
      const uniforms = (m as ShaderMaterial).uniforms ?? {};
      for (const u of Object.values(uniforms))
        if ((u.value as Texture | null)?.isTexture) (u.value as Texture).dispose();
      if ((m as MeshBasicMaterial).map) (m as MeshBasicMaterial).map!.dispose();
      m.dispose();
    }
  });
}

export function draw(scene: Scene, camera: PerspectiveCamera, w: number, h: number): void {
  const r = renderer();
  const c = r.domElement;
  if (c.width !== Math.round(w * r.getPixelRatio()) || c.height !== Math.round(h * r.getPixelRatio()))
    r.setSize(w, h, false);
  r.render(scene, camera);
}
