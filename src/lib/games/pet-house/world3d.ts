import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ActivityScene, Built, Follow, HeldCamera } from './activity';
import type { Actor, Toy, WorldView } from './behavior';
import type { Pet } from './engine';
import { LAYOUTS, ROOM, type Layout, type Perch } from './layout';
import { graphics, type Quality } from '$lib/graphics.svelte';
import { NATURAL_ROOM, type RoomLook } from './decor';
import { daylight, now, type Daylight } from './daytime';
import { createPet, type PetModel } from './models';
import type { Part } from './petting';
import { bowl, brushModel, present, toyModel, wandModel } from './props';
import { buildRoom } from './scene-room';
import { buildPark } from './scenes';
import { lampGlass, lampPool, paintDome, SkyFx } from './sky3d';
import { createWand, stepWand, type Wand } from './wand';
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
/** 当たりはこの半径（メートル）の球。指は絵より太いので、見た目の体より大きめにとる */
const HIT_R = 0.24;
const HIT_Y = 0.18;
const PHOTO_MAX = 512;

/**
 * なでる場所を、体を丸でおおった当たりで決める。丸は models.ts の骨（頭・あご・耳・首・胸・腰・しっぽ・前足）の
 * 世界の位置から置く。首と胴の丸は、当たった点が骨より下（up の逆）なら below の場所にする。
 * 上向きは胸の骨から取るので、あお向けになってもおなかは上に来る
 */
export interface BodyMark {
  part: Part;
  at: THREE.Vector3;
  r: number;
  below?: { part: Part; up: THREE.Vector3 };
}

export function bodyMarks(group: THREE.Object3D): BodyMark[] {
  const bone = (n: string) => group.getObjectByName(n)?.getWorldPosition(new THREE.Vector3());
  const [head, jaw, earL, earR, neck, chest, hips] = ['head', 'jaw', 'ear.l', 'ear.r', 'neck', 'chest', 'hips'].map(
    bone
  );
  if (!head || !jaw || !earL || !earR || !neck || !chest || !hips) return [];
  const L = chest.distanceTo(hips);
  const hr = earL.distanceTo(earR) * 0.7;
  const marks: BodyMark[] = [];
  const ears = earL.clone().add(earR).multiplyScalar(0.5);
  const skull = head.clone().lerp(ears, 0.5);
  marks.push({ part: 'head', at: skull, r: hr });
  // 耳は付け根の骨から外へのびるので、丸を耳の先のほうへずらす
  for (const e of [earL, earR])
    marks.push({
      part: 'head',
      at: e.clone().add(
        e
          .clone()
          .sub(skull)
          .setLength(hr * 0.6)
      ),
      r: hr * 0.7
    });
  const face = skull.clone().lerp(jaw, 0.4);
  const down = face.clone().sub(ears).normalize();
  marks.push({ part: 'chin', at: jaw.clone().addScaledVector(down, hr * 0.5), r: hr * 0.72 });
  const side = earL.clone().sub(ears).multiplyScalar(1.3);
  for (const s of [1, -1]) marks.push({ part: 'cheek', at: face.clone().addScaledVector(side, s), r: hr * 0.55 });
  const up = new THREE.Vector3();
  group.getObjectByName('chest')!.matrixWorld.extractBasis(new THREE.Vector3(), up, new THREE.Vector3());
  up.normalize();
  // のどをなでるのはあごと同じ
  marks.push({ part: 'back', at: neck, r: L * 0.45, below: { part: 'chin', up } });
  for (const t of [0, 0.33, 0.66, 1])
    marks.push({ part: 'back', at: chest.clone().lerp(hips, t), r: L * 0.75, below: { part: 'belly', up } });
  const tail: THREE.Vector3[] = [];
  for (let i = 0, p; (p = bone(`tail.${i}`)); i++) tail.push(p);
  if (tail.length) marks.push({ part: 'rear', at: tail[0], r: L * 0.35 });
  for (const p of tail.slice(1)) marks.push({ part: 'tail', at: p, r: L * 0.22 });
  for (const n of ['fl.2', 'fr.2', 'fl.3', 'fr.3']) {
    const p = bone(n);
    if (p) marks.push({ part: 'paw', at: p, r: L * 0.25 });
  }
  return marks;
}

/** ray が最初に入る丸の場所と、そこまでの距離。どの丸にも当たらなければ null */
export function partOnRay(marks: BodyMark[], ray: THREE.Ray): { part: Part; d: number } | null {
  const sphere = new THREE.Sphere();
  const at = new THREE.Vector3();
  let best: { part: Part; d: number } | null = null;
  for (const m of marks) {
    if (!ray.intersectSphere(sphere.set(m.at, m.r), at)) continue;
    const d = at.distanceTo(ray.origin);
    if (!best || d < best.d) best = { part: markPart(m, at), d };
  }
  return best;
}

/** 丸の中の点 p の場所。横腹の下半分から下をおなかにする（上から見下ろすカメラでは、体の下側はほとんど見えない） */
function markPart(m: BodyMark, p: THREE.Vector3): Part {
  return m.below && p.clone().sub(m.at).dot(m.below.up) < -0.15 * m.r ? m.below.part : m.part;
}

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
  /** 日の差す向き（daytime.ts）。部屋では左の窓から、床と壁に斜めの影が落ちる */
  readonly #sunDir = new THREE.Vector3();
  #day: Daylight;
  #outdoor = false;
  readonly #sky = new SkyFx();
  readonly #blob = blobMaterial();
  readonly #pets = new Map<string, PetView>();
  readonly #presents = new Map<number, THREE.Group>();
  readonly #wand = wandModel();
  #wandRig: Wand | null = null;
  readonly #brush = brushModel();
  readonly #ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly #focus = new THREE.Vector3();
  #camZ = 0;
  readonly #ray = new THREE.Raycaster();
  readonly #v = new THREE.Vector3();
  #follow: Follow | HeldCamera = FOLLOW.room;
  #layout: Layout = ROOM;
  #built: Built | null = null;
  /** 部屋の棚に飾るトロフィー。コンテストごとに、1 位をとった階級の数 */
  trophies: Partial<Record<ContestId, number>> = {};
  room: RoomLook = NATURAL_ROOM;
  #bowls: { food: ReturnType<typeof bowl>; water: ReturnType<typeof bowl> } | null = null;
  #toy: { src: Toy; obj: THREE.Object3D } | null = null;
  #actors: Actor[] = [];
  #w = 1;
  #h = 1;
  #quality: Quality | null = null;
  /** 絵を上へずらす割合（画面の高さに対して）。下をシートがふさいでも、試着したペットを上に見せる */
  lift = 0;
  #lifted = 0;
  /** syncPets でまだ組み立てていない子の数。初めて使う種類は形の組み立てに数百 ms かかるので 1 匹ずつ作る */
  pending = 0;

  constructor(canvas: HTMLCanvasElement) {
    const c = now();
    this.#day = daylight(c.hour, c.weather);
    this.#sunDir.set(...this.#day.sun.dir);
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
    this.scene.add(this.#ring, this.#wand.group, this.#brush, this.#sky.group);
  }

  resize(w: number, h: number): void {
    this.#w = w;
    this.#h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.#lifted) this.camera.setViewOffset(w, h, 0, this.#lifted * h, w, h);
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
        ? target.build(this.#sunDir)
        : kind === 'room'
          ? buildRoom(this.#sunDir, this.trophies, this.room)
          : buildPark();
    this.scene.add(this.#built.group);
    const outdoor = typeof target === 'string' ? kind === 'park' : target.outdoor;
    this.#outdoor = outdoor;
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
    if (!outdoor) this.scene.fog = null;
    else {
      // 遠くの家並みと木だけを空の色へかすませる。ペットのまわり（10m 以内）には掛からない
      const fog = typeof target === 'string' ? undefined : target.fog;
      this.scene.fog = new THREE.Fog('#dbe9f2', fog?.near ?? 12, fog?.far ?? 42);
    }
    this.#applyDay();
    const c = this.#layout.camera;
    this.camera.fov = c.fov;
    this.camera.updateProjectionMatrix();
    this.#focus.set(this.#layout.front.x, 0, this.#layout.front.z);
    this.#camZ = c.z;
    this.#aim();
  }

  /** 部屋にいるときだけ、模様替えした見た目に組み直す。カメラ・ペット・お皿はそのまま */
  refreshRoom(): void {
    if (this.#layout !== ROOM || !this.#built) return;
    this.#built.dispose();
    this.#built.group.removeFromParent();
    this.#built = buildRoom(this.#sunDir, this.trophies, this.room);
    this.scene.add(this.#built.group);
    this.#built.daylight?.(this.#day);
  }

  /** 時刻と天気。変わったときだけ呼ぶ（空の絵を描き直すので毎フレームは呼ばない） */
  setDaylight(d: Daylight): void {
    this.#day = d;
    this.#applyDay();
  }

  /** 光・空・霧・明かり・雨と雪を、いまの場面と時刻に合わせる。昼の晴れは時刻を入れる前と同じ数字になる */
  #applyDay() {
    const d = this.#day;
    const out = this.#outdoor;
    const light = out ? d.sun : d.room;
    this.#sun.color.set(light.color);
    this.#sun.intensity = light.power;
    // くもりや夜の弱い光でくっきりした影が落ちると、晴れの昼に見える
    this.#sun.shadow.intensity = 0.8 * Math.min(1, light.power / 2.2);
    this.#sunDir.set(...light.dir);
    if (out) {
      this.#hemi.color.set(d.hemi.sky);
      this.#hemi.groundColor.set(d.hemi.ground);
      this.#hemi.intensity = 0.7 * d.hemi.power;
    } else {
      this.#hemi.color.set(d.room.hemi);
      this.#hemi.groundColor.set('#b08a66');
      this.#hemi.intensity = 0.45 * d.room.hemiPower;
    }
    // 映り込みの RoomEnvironment も部屋を照らすので、夜と明かりをつけた部屋では弱めて暗さを残す
    this.scene.environmentIntensity = 0.35 * (1 - 0.45 * (out ? d.night : d.lamps));
    this.scene.fog?.color.set(d.fog);
    (this.scene.background as THREE.Color).set(out ? d.sky[2] : '#bfe0fb');
    lampGlass.emissiveIntensity = 2.6 * d.lamps;
    lampPool.opacity = 0.45 * d.lamps;
    const dome = this.#built?.group.getObjectByName('sky');
    if (dome) paintDome(dome, d);
    this.#built?.daylight?.(d);
    this.#sky.set(d, out);
    this.#sun.position.copy(this.#sun.target.position).addScaledVector(this.#sunDir, 6);
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
    // 初めて使う種類の組み立ては 1 匹ぶんで数百 ms かかるので、1 回の呼び出しで作るのは 1 匹まで。
    // 残りは pending に数え、まだ組み立てていない子は #pets に入れないので update() は落ちない
    let budget = 1;
    let pending = 0;
    for (const pet of pets) {
      let view = this.#pets.get(pet.id);
      if (view && view.breed !== pet.breed) {
        view.model.dispose();
        view.blob.removeFromParent();
        this.#pets.delete(pet.id);
        view = undefined;
      }
      if (!view) {
        if (budget <= 0) {
          pending++;
          continue;
        }
        budget--;
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
    this.pending = pending;
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
      pv.model.group.position.set(a.x, a.y, a.z);
      pv.model.group.rotation.y = a.heading;
      pv.blob.position.set(a.x, (a.hop?.under ?? a.y) + 0.009, a.z);
      pv.blob.rotation.y = a.heading;
      pv.model.update(a.action, dt, { speed: a.speed, wag: a.wag, look: a.look, t });
    }

    const me = actors.find((a) => a.petId === current);
    this.#ring.visible = !!me && actors.length > 1;
    if (me) {
      // ラグの上面（0.008）と同じ高さだとちらつく
      this.#ring.position.set(me.x, (me.hop?.under ?? me.y) + 0.012, me.z);
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
      // 揺れを持たずに先の位置だけ渡すモードもあるので、そのときはここで揺らす
      let rig = wand.rig;
      if (!rig) {
        const at = { x: wand.x, y: wand.y ?? 0, z: wand.z };
        rig = this.#wandRig ??= createWand(at);
        stepWand(rig, at, dt);
      }
      // 竿の手元は、竿の先と同じ奥行きで画面の上の外に置く。どの場面のカメラでも、奥へ振っても根元が写らない
      const grip = this.#v.set(rig.hand.x, rig.hand.y, rig.hand.z).project(this.camera);
      grip.set(grip.x * 0.6 + 0.35, 1.35, grip.z).unproject(this.camera);
      this.#wand.draw(rig, t, grip);
    } else this.#wandRig = null;
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
    if ('rate' in f) {
      const k = view.wand ? 0 : 1 - Math.exp(-f.rate * dt);
      if (me) this.#focus.lerp(this.#v.set(me.x, me.y, me.z), k);
      const c = this.#layout.camera;
      let z = c.z + this.#focus.z - this.#layout.front.z;
      for (const a of actors) z = Math.max(z, a.z + f.near);
      this.#camZ += (z - this.#camZ) * k;
    }
    this.#aim(dt);
    this.#sky.step(dt, this.camera);
    const lifted = THREE.MathUtils.damp(this.#lifted, this.lift, 6, dt);
    if (lifted !== this.#lifted) {
      this.#lifted = Math.abs(lifted - this.lift) < 1e-3 ? this.lift : lifted;
      // 見る範囲を下へずらすので、床をさわった点の変換（raycast）もこのずれのまま合う
      if (this.#lifted) this.camera.setViewOffset(this.#w, this.#h, 0, this.#lifted * this.#h, this.#w, this.#h);
      else this.camera.clearViewOffset();
    }
  }

  #aim(dt = 0) {
    const f = this.#follow;
    if ('camera' in f) this.#hold(f.camera(dt));
    else this.#chase(f);
    // 影の範囲はペットのまわりだけにして、影の 1 画素を細かく保つ
    this.#sun.target.position.set(this.#focus.x, 0, this.#focus.z - 0.4);
    this.#sun.position.copy(this.#sun.target.position).addScaledVector(this.#sunDir, 6);
  }

  #hold(c: Layout['camera']) {
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.lookX, c.lookY, c.lookZ);
    if (this.camera.fov !== c.fov) {
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
    }
    this.#focus.set(c.lookX, 0, c.lookZ);
  }

  #chase(f: Follow) {
    const c = this.#layout.camera;
    const front = this.#layout.front;
    const fx = this.#focus.x;
    const dz = this.#focus.z - front.z;
    const z = THREE.MathUtils.clamp(this.#camZ, f.zMin, f.zMax);
    this.camera.position.set(THREE.MathUtils.clamp(c.x + fx - front.x, -f.x, f.x), c.y, z);
    // ソファの上の子を見るときは、その高さのぶん少し見上げる
    this.camera.lookAt(c.lookX + fx - front.x, c.lookY + this.#focus.y * 0.6, c.lookZ + dz);
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

  /** 描く前にシェーダーを準備する。KHR_parallel_shader_compile があれば止まらずに待てる（無ければその場で準備して返る） */
  precompile(): Promise<unknown> {
    return this.renderer.compileAsync(this.scene, this.camera);
  }

  #screenHit(px: number, py: number) {
    let best: { id: string; d: number } | null = null;
    for (const a of this.#actors) {
      const [sx, sy, k] = this.project(a.x, a.y + HIT_Y, a.z);
      if (Math.hypot(px - sx, py - sy) > Math.max(HIT_R * k, 44)) continue;
      const d = this.camera.position.distanceTo(this.#v.set(a.x, a.y + HIT_Y, a.z));
      if (!best || d < best.d) best = { id: a.petId, d };
    }
    return best?.id ?? null;
  }

  pick(px: number, py: number): string | null {
    return this.#screenHit(px, py);
  }

  /**
   * 指の下のペットと、なでた体の場所。体をおおう丸に当たればその場所、
   * 丸から外れてもペットのまわりの余白（pick の当たり）なら、画面でいちばん近い丸の場所
   */
  pickPart(px: number, py: number): { id: string; part: Part } | null {
    this.#ray.setFromCamera(new THREE.Vector2((px / this.#w) * 2 - 1, 1 - (py / this.#h) * 2), this.camera);
    const all = this.#actors.flatMap((a) => {
      const group = this.#pets.get(a.petId)?.model.group;
      if (!group?.visible) return [];
      // 何も起きていないあいだは描くのを間引くので、骨の行列が古いことがある
      group.updateMatrixWorld(true);
      return [{ id: a.petId, marks: bodyMarks(group) }];
    });
    let best: { id: string; part: Part; d: number } | null = null;
    for (const { id, marks } of all) {
      const on = partOnRay(marks, this.#ray.ray);
      if (on && (!best || on.d < best.d)) best = { id, ...on };
    }
    if (best) return { id: best.id, part: best.part };
    const id = this.#screenHit(px, py);
    const marks = all.find((p) => p.id === id)?.marks;
    if (!id || !marks?.length) return null;
    const near = (m: BodyMark) => {
      const [sx, sy, k] = this.project(m.at.x, m.at.y, m.at.z);
      return Math.hypot(px - sx, py - sy) - m.r * k;
    };
    const m = marks.reduce((a, b) => (near(b) < near(a) ? b : a));
    return { id, part: markPart(m, this.#ray.ray.closestPointToPoint(m.at, this.#v)) };
  }

  /** 指の下の部屋のソファかベッドと、当たった点 */
  furniture(px: number, py: number): { id: Perch['id']; x: number; z: number } | null {
    const group = this.#layout === ROOM ? this.#built?.group : undefined;
    const targets = (['sofa', 'bed'] as const).flatMap((id) => group?.getObjectByName(id) ?? []);
    if (!targets.length) return null;
    this.#ray.setFromCamera(new THREE.Vector2((px / this.#w) * 2 - 1, 1 - (py / this.#h) * 2), this.camera);
    const hit = this.#ray.intersectObjects(targets, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !targets.includes(o)) o = o.parent;
    return hit && o ? { id: o.name as Perch['id'], x: hit.point.x, z: hit.point.z } : null;
  }

  floor(px: number, py: number, y = 0): { x: number; z: number } | null {
    this.#ray.setFromCamera(new THREE.Vector2((px / this.#w) * 2 - 1, 1 - (py / this.#h) * 2), this.camera);
    const hit = this.#ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), this.#v);
    // 地平線より上を指すと、遠すぎる点か交わらない。どちらも床の点としては使えない
    if (!hit || hit.distanceTo(this.camera.position) > 25) return null;
    return { x: hit.x, z: hit.z };
  }

  /** 指の下の、奥行き z に立てた面の点。ねこじゃらしをペットの顔の前で持ち上げるのに使う */
  upright(px: number, py: number, z: number): { x: number; y: number; z: number } | null {
    this.#ray.setFromCamera(new THREE.Vector2((px / this.#w) * 2 - 1, 1 - (py / this.#h) * 2), this.camera);
    const hit = this.#ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), this.#v);
    return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
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
    this.#sky.dispose();
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
