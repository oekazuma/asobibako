import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ActivityScene, Built, Follow } from './activity';
import type { Actor, Toy, WorldView } from './behavior';
import type { Pet } from './engine';
import { LAYOUTS, ROOM, type Layout } from './layout';
import { graphics, type Quality } from '$lib/graphics.svelte';
import { createPet, type PetModel } from './models';
import { bowl, brushModel, present, toyModel, wandModel } from './props';
import { buildPark, buildRoom } from './scenes';
import type { Tool } from './session.svelte';
import type { BaseScene, BreedId, ContestId, ToyId } from './types';

/**
 * カメラは layout.camera を「いまのペットが front にいるとき」の構えとして、ペットの動きに合わせて平行に動かす。
 * zMin で奥へ入りすぎないようにする（ペットに付いて奥へ行くと、手前の家具が画面をふさぐ）。
 * near は、どのペットともこれだけ z を離す距離。ほかのペットが手前の端へ来ても、画面の下を体でふさがない。
 * x はカメラが横の壁や木に近づきすぎないようにする範囲。はみ出たぶんは首を振ってペットを画面に入れる
 */
const FOLLOW: Record<BaseScene, Follow> = {
  room: { x: 0.7, zMin: 1.7, zMax: 3.3, near: 1.8, rate: 1.6, shadow: 2 },
  park: { x: 1.4, zMin: -2.5, zMax: 3.6, near: 1.9, rate: 1.8, shadow: 2.4 }
};
/** 日の差す向き。部屋では左の窓から、床と壁に斜めの影が落ちる */
const SUN_DIR = new THREE.Vector3(-2.6, 4, -0.8).normalize();
/** 当たりはこの半径（メートル）の球。指は絵より太いので、見た目の体より大きめにとる */
const HIT_R = 0.24;
const HIT_Y = 0.18;
const PHOTO_MAX = 512;

interface PetView {
  breed: BreedId;
  model: PetModel;
  /** 足元の淡い影。日の影だけでは、真上から光が来ない向きで浮いて見える */
  blob: THREE.Mesh;
  accessory: Pet['accessory'];
  dirt: number;
}

/** 3D の部屋と公園。ペットの頭の中（behavior）が決めた位置と動きを写して描くだけで、ルールは持たない */
export class PetWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  readonly #sun = new THREE.DirectionalLight('#ffe2c2', 2.6);
  readonly #hemi = new THREE.HemisphereLight('#f4f1ff', '#b08a66', 0.55);
  readonly #blob = blobMaterial();
  readonly #pets = new Map<string, PetView>();
  readonly #presents = new Map<number, THREE.Group>();
  readonly #wand = wandModel();
  readonly #brush = brushModel();
  readonly #ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly #focus = new THREE.Vector3();
  #camZ = 0;
  readonly #ray = new THREE.Raycaster();
  readonly #v = new THREE.Vector3();
  #follow: Follow = FOLLOW.room;
  #layout: Layout = ROOM;
  #built: Built | null = null;
  /** 部屋の棚に飾るトロフィー。コンテストごとに、1 位をとった階級の数 */
  trophies: Partial<Record<ContestId, number>> = {};
  #bowls: { food: ReturnType<typeof bowl>; water: ReturnType<typeof bowl> } | null = null;
  #toy: { src: Toy; obj: THREE.Object3D } | null = null;
  #actors: Actor[] = [];
  #w = 1;
  #h = 1;
  #quality: Quality | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    // この版の PCF は shadow.radius の円盤でぼかす（PCFSoft は廃止された）
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#bfe0fb');
    // 金属のお皿や布のつやに映り込む部屋の明るさ。強いと日なたと日かげの差が消えるので控えめにする
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    env.dispose();
    pmrem.dispose();
    this.scene.add(this.#hemi);
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(2048, 2048);
    this.#sun.shadow.radius = 4;
    this.#sun.shadow.intensity = 0.8;
    this.#sun.shadow.bias = -0.0004;
    this.#sun.shadow.normalBias = 0.015;
    this.scene.add(this.#sun, this.#sun.target);

    this.#ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.33, 48),
      new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.6, depthWrite: false })
    );
    this.#ring.rotation.x = -Math.PI / 2;
    this.#wand.group.visible = false;
    this.#brush.visible = false;
    this.scene.add(this.#ring, this.#wand.group, this.#brush);
  }

  resize(w: number, h: number): void {
    this.#w = w;
    this.#h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 部屋と公園は名前で、遊びのモードの場面はモードが渡す ActivityScene で作る */
  setScene(target: BaseScene | ActivityScene): void {
    this.#built?.dispose();
    this.#built?.group.removeFromParent();
    this.#bowls?.food.group.removeFromParent();
    this.#bowls?.water.group.removeFromParent();
    this.#bowls = null;
    for (const g of this.#presents.values()) g.removeFromParent();
    this.#presents.clear();
    this.#dropToy();

    const kind = typeof target === 'string' ? target : target.id;
    this.#layout = typeof target === 'string' ? LAYOUTS[target] : target.layout;
    this.#follow = typeof target === 'string' ? FOLLOW[target] : target.follow;
    this.#built =
      typeof target !== 'string'
        ? target.build(SUN_DIR)
        : kind === 'room'
          ? buildRoom(SUN_DIR, this.trophies)
          : buildPark();
    this.scene.add(this.#built.group);
    const outdoor = typeof target === 'string' ? kind === 'park' : target.outdoor;
    if (kind === 'room') {
      this.#bowls = { food: bowl(), water: bowl() };
      this.#bowls.food.group.position.set(ROOM.food.x, 0, ROOM.food.z);
      this.#bowls.water.group.position.set(ROOM.water.x, 0, ROOM.water.z);
      this.scene.add(this.#bowls.food.group, this.#bowls.water.group);
    }
    const s = this.#sun.shadow.camera;
    const r = this.#follow.shadow;
    s.left = s.bottom = -r;
    s.right = s.top = r;
    s.near = 0.5;
    s.far = 14;
    s.updateProjectionMatrix();
    if (!outdoor) {
      this.#sun.intensity = 3;
      this.#hemi.intensity = 0.45;
      this.scene.fog = null;
    } else {
      this.#sun.intensity = 3;
      this.#hemi.intensity = 0.7;
      // 遠くの家並みと木だけを空の色へかすませる。ペットのまわり（10m 以内）には掛からない
      this.scene.fog = new THREE.Fog('#dbe9f2', 12, 42);
    }
    const c = this.#layout.camera;
    this.camera.fov = c.fov;
    this.camera.updateProjectionMatrix();
    this.#focus.set(this.#layout.front.x, 0, this.#layout.front.z);
    this.#camZ = c.z;
    this.#aim();
  }

  /** 設定の画質を、画面の細かさ・影・毛並みに映す。設定の画面で変えたらすぐ効くよう毎フレーム見る */
  #applyQuality(): Quality {
    const q = graphics.quality;
    if (q === this.#quality) return q;
    this.#quality = q;
    this.renderer.setPixelRatio(Math.min({ high: 1.5, normal: 1.25, low: 1 }[q], devicePixelRatio));
    this.renderer.setSize(this.#w, this.#h, false);
    const size = q === 'low' ? 1024 : 2048;
    if (this.#sun.shadow.mapSize.x !== size) {
      this.#sun.shadow.mapSize.set(size, size);
      this.#sun.shadow.map?.dispose();
      this.#sun.shadow.map = null;
    }
    for (const view of this.#pets.values()) view.model.setQuality(q);
    return q;
  }

  syncPets(pets: Pet[]): void {
    const quality = this.#applyQuality();
    for (const pet of pets) {
      let view = this.#pets.get(pet.id);
      if (view && view.breed !== pet.breed) {
        view.model.dispose();
        view.blob.removeFromParent();
        view = undefined;
      }
      if (!view) {
        const model = createPet(pet.breed, quality);
        const size = new THREE.Box3().setFromObject(model.group).getSize(this.#v);
        const blob = new THREE.Mesh(blobGeometry, this.#blob);
        blob.scale.set(size.x * 1.5, 1, size.z * 1.25);
        blob.renderOrder = 1;
        view = { breed: pet.breed, model, blob, accessory: null, dirt: 0 };
        model.group.visible = blob.visible = false;
        this.#pets.set(pet.id, view);
        this.scene.add(model.group, blob);
      }
      if (view.accessory !== pet.accessory) {
        view.accessory = pet.accessory;
        view.model.setAccessory(pet.accessory);
      }
      // きれいが 70 を切ったあたりから汚れが見えはじめ、0 で全部出る
      const dirt = Math.round(Math.max(0, (70 - pet.stats.clean) / 70) * 9) / 9;
      if (view.dirt !== dirt) {
        view.dirt = dirt;
        view.model.setDirt(dirt);
      }
    }
    for (const [id, view] of this.#pets) {
      if (pets.some((p) => p.id === id)) continue;
      view.model.dispose();
      view.blob.removeFromParent();
      this.#pets.delete(id);
    }
  }

  /** ペットの 3D。遊びのモードがぬれ・泡のように、ふだんの遊びにない見た目を変えるとき */
  model(petId: string): PetModel | undefined {
    return this.#pets.get(petId)?.model;
  }

  /** ブラシを描く位置。null で隠す */
  setBrush(p: { x: number; y: number; z: number } | null): void {
    this.#brush.visible = p !== null;
    if (p) this.#brush.position.set(p.x, p.y, p.z);
  }

  update(actors: Actor[], view: WorldView, dt: number, t: number, current: string, tool: Tool): void {
    this.#actors = actors;
    for (const [id, pv] of this.#pets) {
      const a = actors.find((x) => x.petId === id);
      pv.model.group.visible = pv.blob.visible = !!a;
      if (!a) continue;
      pv.model.group.position.set(a.x, 0, a.z);
      pv.model.group.rotation.y = a.heading;
      pv.blob.position.set(a.x, 0.009, a.z);
      pv.blob.rotation.y = a.heading;
      pv.model.update(a.action, dt, { speed: a.speed, wag: a.wag, look: a.look, t });
    }

    const me = actors.find((a) => a.petId === current);
    this.#ring.visible = !!me && actors.length > 1;
    if (me) {
      this.#ring.position.set(me.x, 0.008, me.z);
      this.#ring.material.opacity = 0.45 + 0.15 * Math.sin(t * 3);
    }

    this.#showToy(view.toy, dt);

    if (this.#bowls) {
      this.#bowls.food.setFill(view.bowls.food ? 'food' : null, view.bowls.foodLeft);
      this.#bowls.water.setFill('water', view.bowls.waterLeft);
    }

    const wand = view.wand;
    this.#wand.group.visible = !!wand;
    if (wand) {
      const y = wand.moving ? 0.04 + 0.05 * Math.abs(Math.sin(t * 9)) : 0.1 + 0.02 * Math.sin(t * 3);
      this.#wand.setTip(wand.x, y, wand.z);
    }
    if (tool !== 'brush') this.#brush.visible = false;

    for (const p of view.presents) {
      if (this.#presents.has(p.id)) continue;
      const g = present();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.id * 1.7;
      this.#presents.set(p.id, g);
      this.scene.add(g);
    }
    for (const [id, g] of this.#presents) {
      if (view.presents.some((p) => p.id === id)) {
        // 見つけてもらえるよう、ときどき小さく跳ねる
        const hop = Math.max(0, Math.sin(t * 2.4 + id * 1.3));
        g.position.y = hop ** 8 * 0.05;
        continue;
      }
      g.removeFromParent();
      this.#presents.delete(id);
    }

    // ねこじゃらしを振っているあいだは止める。カメラが動くと、止めた指の下の床の点まで流れてしまう
    this.#built?.update?.(dt, t);
    const f = this.#follow;
    const k = view.wand ? 0 : 1 - Math.exp(-f.rate * dt);
    if (me) this.#focus.lerp(this.#v.set(me.x, 0, me.z), k);
    const c = this.#layout.camera;
    let z = c.z + this.#focus.z - this.#layout.front.z;
    for (const a of actors) z = Math.max(z, a.z + f.near);
    this.#camZ += (z - this.#camZ) * k;
    this.#aim();
  }

  #aim() {
    const c = this.#layout.camera;
    const f = this.#follow;
    const front = this.#layout.front;
    const fx = this.#focus.x;
    const dz = this.#focus.z - front.z;
    const z = THREE.MathUtils.clamp(this.#camZ, f.zMin, f.zMax);
    this.camera.position.set(THREE.MathUtils.clamp(c.x + fx - front.x, -f.x, f.x), c.y, z);
    this.camera.lookAt(c.lookX + fx - front.x, c.lookY, c.lookZ + dz);
    // 影の範囲はペットのまわりだけにして、影の 1 画素を細かく保つ
    this.#sun.target.position.set(fx, 0, this.#focus.z - 0.4);
    this.#sun.position.copy(this.#sun.target.position).addScaledVector(SUN_DIR, 6);
  }

  #dropToy() {
    this.#toy?.obj.removeFromParent();
    this.#toy = null;
  }

  #showToy(toy: Toy | null, dt: number) {
    if (this.#toy?.src !== toy) {
      this.#dropToy();
      if (toy && toy.kind !== 'wand') this.#toy = { src: toy, obj: toyModel(toy.kind) };
    }
    if (!toy || !this.#toy) return;
    const obj = this.#toy.obj;
    const mouth = toy.holder ? this.#pets.get(toy.holder)?.model.mouth : undefined;
    if (mouth) {
      if (obj.parent !== mouth) {
        mouth.add(obj);
        hold(obj, toy.kind);
      }
      return;
    }
    if (obj.parent !== this.scene) {
      this.scene.add(obj);
      obj.rotation.set(0, 0, 0);
    }
    obj.position.set(toy.x, toy.y, toy.z);
    if (toy.kind === 'ball') {
      obj.rotation.x += (toy.vz * dt) / 0.045;
      obj.rotation.z -= (toy.vx * dt) / 0.045;
    } else if (toy.kind === 'frisbee') {
      if (!toy.still) obj.rotation.y += dt * 14;
      obj.rotation.x = obj.rotation.z = 0;
    } else if (Math.hypot(toy.vx, toy.vz) > 0.05) obj.rotation.y = Math.atan2(toy.vx, toy.vz);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  #screenHit(px: number, py: number) {
    let best: { id: string; d: number } | null = null;
    for (const a of this.#actors) {
      const [sx, sy, k] = this.project(a.x, HIT_Y, a.z);
      if (Math.hypot(px - sx, py - sy) > Math.max(HIT_R * k, 44)) continue;
      const d = this.camera.position.distanceTo(this.#v.set(a.x, HIT_Y, a.z));
      if (!best || d < best.d) best = { id: a.petId, d };
    }
    return best?.id ?? null;
  }

  pick(px: number, py: number): string | null {
    return this.#screenHit(px, py);
  }

  floor(px: number, py: number, y = 0): { x: number; z: number } | null {
    this.#ray.setFromCamera(new THREE.Vector2((px / this.#w) * 2 - 1, 1 - (py / this.#h) * 2), this.camera);
    const hit = this.#ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), this.#v);
    // 地平線より上を指すと、遠すぎる点か交わらない。どちらも床の点としては使えない
    if (!hit || hit.distanceTo(this.camera.position) > 25) return null;
    return { x: hit.x, z: hit.z };
  }

  project(x: number, y: number, z: number): [number, number, number] {
    const p = new THREE.Vector3(x, y, z);
    const depth = -p.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    p.project(this.camera);
    const perMeter = this.#h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.max(depth, 0.05));
    return [((p.x + 1) / 2) * this.#w, ((1 - p.y) / 2) * this.#h, perMeter];
  }

  snapshot(): string {
    // preserveDrawingBuffer を切っているので、描いた直後の同じタスクのうちに写し取る
    this.render();
    const src = this.renderer.domElement;
    const k = Math.min(1, PHOTO_MAX / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * k);
    c.height = Math.round(src.height * k);
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }

  dispose(): void {
    this.#built?.dispose();
    for (const view of this.#pets.values()) view.model.dispose();
    this.#ring.geometry.dispose();
    this.#ring.material.dispose();
    this.#blob.map?.dispose();
    this.#blob.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
}

const blobGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function blobMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgb(0 0 0 / 0.7)');
  r.addColorStop(0.45, 'rgb(0 0 0 / 0.4)');
  r.addColorStop(1, 'rgb(0 0 0 / 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c),
    color: '#2a1a10',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
}

/** 咥えたときの向き。mouth は鼻先にあるので、形の中心を少し下と前へずらす */
function hold(obj: THREE.Object3D, kind: ToyId) {
  obj.rotation.set(0, 0, 0);
  obj.position.set(0, -0.012, 0.02);
  if (kind === 'frisbee') {
    // 縦に持たせると正面から顔と胸がかくれるので、あごの下で平たく咥えさせる
    obj.rotation.set(-0.2, 0, 0);
    obj.position.set(0, -0.01, 0.08);
  } else if (kind === 'mouse') obj.rotation.y = Math.PI / 2;
}
