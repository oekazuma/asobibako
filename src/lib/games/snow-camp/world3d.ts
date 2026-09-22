import * as THREE from 'three';
import { Details } from './details';
import {
  FIRE,
  HUNT_BOTTOM,
  MONEY,
  TABLE,
  WORLD_H,
  WORLD_W,
  type Animal,
  type CampEvent,
  type GameState
} from './engine';
import type { Objective } from './guide';
import { axe, badge, bear, coin, fire, marker, mat, meat, person, pine, pointer, rabbit } from './models';

const CAMP_TOP = HUNT_BOTTOM + 0.1;
/** カメラは主人公の後ろ上から見下ろす */
const CAM_BACK = 1.35;
const CAM_UP = 1.75;

function planks() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c48a5a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = y % 64 ? '#bd8252' : '#c9915f';
    g.fillRect(0, y, 256, 30);
    g.fillStyle = 'rgb(90 50 20 / 0.35)';
    g.fillRect(0, y + 30, 256, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/** 静かに置いてあるもの（地面・木・柵・山・キャンプの家具） */
function scenery(scene: THREE.Scene, trees: GameState['rules']['trees']) {
  const snow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    mat('#f4f8ff', { emissive: '#dfe9f7', emissiveIntensity: 0.3 })
  );
  snow.rotation.x = -Math.PI / 2;
  snow.position.set(WORLD_W / 2, 0, WORLD_H / 2);
  snow.receiveShadow = true;
  scene.add(snow);

  // 雪の吹きだまり
  for (let i = 0; i < 26; i++) {
    const drift = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 8),
      mat('#f7fbff', { emissive: '#e6eef9', emissiveIntensity: 0.3 })
    );
    drift.scale.set(1 + (i % 3) * 0.4, 0.18, 0.7);
    drift.position.set(((i * 0.7548776) % 1) * WORLD_W, 0, ((i * 0.5698403) % 1) * HUNT_BOTTOM);
    drift.receiveShadow = true;
    scene.add(drift);
  }

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_W - 0.1, 0.02, WORLD_H - CAMP_TOP - 0.04),
    new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.85 })
  );
  deck.position.set(WORLD_W / 2, 0.01, (CAMP_TOP + WORLD_H) / 2);
  deck.receiveShadow = true;
  scene.add(deck);

  for (const t of trees) {
    const tree = pine(t.s);
    tree.position.set(t.x, 0, t.y);
    tree.rotation.y = t.x * 9;
    scene.add(tree);
  }
  // 画面の奥に見える、雪原の外の森と山
  for (let i = 0; i < 24; i++) {
    const tree = pine(0.11 + (i % 4) * 0.02);
    tree.position.set(-0.3 + i * 0.1, 0, -0.1 - (i % 3) * 0.1);
    scene.add(tree);
  }
  for (let i = 0; i < 7; i++) {
    const h = 0.9 + (i % 3) * 0.4;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 6), mat('#a9c4e6', { flatShading: true }));
    mountain.position.set(-1.5 + i * 0.75, h / 2, -2.2 - (i % 2) * 0.5);
    scene.add(mountain);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9 * 0.38, h * 0.38, 6), mat('#ffffff', { flatShading: true }));
    cap.position.set(mountain.position.x, h * 0.81, mountain.position.z);
    scene.add(cap);
  }

  // 柵。真ん中を狩り場への出入り口にする
  const fence = new THREE.Group();
  for (let x = 0.04; x < WORLD_W; x += 0.1) {
    if (Math.abs(x - WORLD_W / 2) < 0.2) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.022), mat('#8a5a3b'));
    post.position.set(x, 0.05, CAMP_TOP - 0.03);
    post.castShadow = true;
    fence.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 6), mat('#ffffff'));
    cap.scale.y = 0.5;
    cap.position.set(x, 0.1, CAMP_TOP - 0.03);
    fence.add(cap);
  }
  for (const [x0, x1] of [
    [0.04, WORLD_W / 2 - 0.2],
    [WORLD_W / 2 + 0.2, WORLD_W - 0.04]
  ]) {
    for (const y of [0.04, 0.075]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.012, 0.01), mat('#a0704b'));
      rail.position.set((x0 + x1) / 2, y, CAMP_TOP - 0.03);
      rail.castShadow = true;
      fence.add(rail);
    }
  }
  scene.add(fence);

  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.08), mat('#ff7b7b'));
  top.position.y = 0.055;
  top.castShadow = true;
  table.add(top);
  for (const [dx, dz] of [
    [-0.085, -0.03],
    [0.085, -0.03],
    [-0.085, 0.03],
    [0.085, 0.03]
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), mat('#7a4e2e'));
    leg.position.set(dx, 0.025, dz);
    table.add(leg);
  }
  table.position.set(TABLE.x, 0.02, TABLE.y);
  scene.add(table);
}

/** 3D の雪原。engine の状態を毎フレーム映す */
export class CampWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 20);
  readonly #sun = new THREE.DirectionalLight('#fff6e8', 2.6);
  readonly #fireLight = new THREE.PointLight('#ff9a3c', 0.8, 0.45, 2);
  readonly #hero = person('#1f9bff', '#ff4d5e');
  readonly #carry = new THREE.Group();
  readonly #flames;
  readonly #animals = new Map<Animal, THREE.Group>();
  readonly #drops = new Map<object, THREE.Group>();
  readonly #guests: THREE.Group[] = [];
  readonly #meals = new THREE.Group();
  readonly #coins = new THREE.Group();
  readonly #badges = new Map<string, THREE.Group>();
  readonly #focus = new THREE.Vector3();
  readonly #axe = axe();
  /** 斧を振り終えるまでの残り秒と、振る相手の位置 */
  #swing = 0;
  readonly #swingAt = new THREE.Vector2();
  readonly #marker = marker();
  readonly #pointer = pointer();
  readonly #details = new Details();
  /** 子どもにも見やすいよう、人と動物は少し大きめに置く */
  static readonly CHARACTER = 1.3;

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#bfe0fb');
    this.scene.fog = new THREE.Fog('#dcebfa', 3, 6.5);

    this.scene.add(new THREE.HemisphereLight('#e8f4ff', '#ffffff', 2.6));
    this.#sun.position.set(0.6, 2, 1);
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(1024, 1024);
    const s = this.#sun.shadow.camera;
    s.left = s.bottom = -1.6;
    s.right = s.top = 1.6;
    s.near = 0.1;
    s.far = 5;
    this.scene.add(this.#sun, this.#sun.target);

    scenery(this.scene, state.rules.trees);
    const f = fire();
    f.group.position.set(FIRE.x, 0.02, FIRE.y);
    this.#flames = f.flames;
    this.#fireLight.position.set(FIRE.x, 0.12, FIRE.y);
    this.scene.add(f.group, this.#fireLight);

    for (const pad of state.pads) {
      const home = pad.id === 'home';
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(home ? 0.26 : 0.2, 0.03, home ? 0.18 : 0.14),
        mat(home ? '#ffc233' : '#4db5ff')
      );
      base.position.set(pad.x, 0.035, pad.y);
      base.receiveShadow = true;
      this.scene.add(base);
      const b = badge(pad.id);
      b.position.set(pad.x, 0.12, pad.y);
      b.scale.setScalar(home ? 1.4 : 1);
      this.#badges.set(pad.id, b);
      this.scene.add(b);
    }
    this.#meals.position.set(TABLE.x, 0.083, TABLE.y);
    this.#coins.position.set(MONEY.x, 0.022, MONEY.y);
    this.#hero.group.add(this.#carry);
    this.#carry.position.set(0, 0.17, -0.01);
    this.#axe.position.set(0.03, 0.065, 0.005);
    this.#hero.group.add(this.#axe);
    this.scene.add(this.#marker.group, this.#pointer, this.#details.group);
    this.#hero.group.scale.setScalar(CampWorld.CHARACTER);
    this.scene.add(this.#hero.group, this.#meals, this.#coins);
    this.#focus.set(state.hero.x, 0, state.hero.y);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #sync<K extends object>(map: Map<K, THREE.Group>, list: K[], make: (item: K) => THREE.Group) {
    for (const item of list) {
      if (map.has(item)) continue;
      const g = make(item);
      map.set(item, g);
      this.scene.add(g);
    }
    for (const [item, g] of map) {
      if (list.includes(item)) continue;
      this.scene.remove(g);
      map.delete(item);
    }
  }

  static readonly SWING_S = 0.28;

  /** engine の出来事に合わせた見た目だけの反応 */
  handle(event: CampEvent, state: GameState): void {
    const { hero } = state;
    const at = (x: number, y: number, z = 0.12) => new THREE.Vector3(x, z, y);
    if (event.type === 'hit') {
      this.#swing = CampWorld.SWING_S;
      this.#swingAt.set(event.x, event.y);
    } else if (event.type === 'deposit') this.#details.fly('meat', at(hero.x, hero.y, 0.22), at(FIRE.x, FIRE.y, 0.08));
    else if (event.type === 'collect')
      for (let i = 0; i < Math.min(event.n, 8); i++)
        this.#details.fly('coin', at(MONEY.x, MONEY.y, 0.04), at(hero.x, hero.y, 0.15), i * 0.05);
    else if (event.type === 'pay') this.#details.fly('coin', at(TABLE.x, TABLE.y, 0.08), at(MONEY.x, MONEY.y, 0.04));
  }

  update(state: GameState, dt: number, now: number, move: { x: number; y: number }, goal: Objective): void {
    const { hero } = state;
    const h = this.#hero.group;
    h.position.set(hero.x, 0.02, hero.y);
    const moving = move.x !== 0 || move.y !== 0;
    if (moving) h.rotation.y = Math.atan2(move.x, move.y);
    // 攻撃のたびに斧を肩の上から振り下ろし、そのあいだは相手のほうを向く
    if (this.#swing > 0) {
      this.#swing = Math.max(0, this.#swing - dt);
      const p = 1 - this.#swing / CampWorld.SWING_S;
      this.#axe.rotation.x = p < 0.35 ? -0.4 - (p / 0.35) * 1.2 : -1.6 + ((p - 0.35) / 0.65) * 3.2;
      h.rotation.y = Math.atan2(this.#swingAt.x - hero.x, this.#swingAt.y - hero.y);
    } else this.#axe.rotation.x = -0.4 + (moving ? Math.sin(now * 14) * 0.15 : 0);

    this.#details.step(hero.x, hero.y, hero.y < HUNT_BOTTOM + 0.05);
    this.#details.update(dt, new THREE.Vector3(FIRE.x, 0, FIRE.y), state.cooking > 0);

    // 行き先の目印と、足もとの矢印
    const m = this.#marker;
    m.group.position.set(goal.x, 0, goal.y);
    m.arrow.position.y = 0.24 + Math.abs(Math.sin(now * 4)) * 0.05;
    m.arrow.rotation.y = now * 2;
    m.ring.scale.setScalar(1 + ((now * 1.5) % 1) * 0.5);
    (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - ((now * 1.5) % 1));
    const far = Math.hypot(goal.x - hero.x, goal.y - hero.y);
    this.#pointer.visible = far > 0.22;
    this.#pointer.position.set(hero.x, 0.03, hero.y);
    this.#pointer.rotation.y = Math.atan2(goal.x - hero.x, goal.y - hero.y);
    this.#pointer.scale.setScalar(1.5 + Math.sin(now * 6) * 0.1);
    const swing = moving ? Math.sin(now * 14) * 0.6 : 0;
    this.#hero.legs[0].rotation.x = swing;
    this.#hero.legs[1].rotation.x = -swing;
    h.position.y = 0.02 + (moving ? Math.abs(Math.sin(now * 14)) * 0.008 : 0);

    // 持っている肉を背中に積む
    while (this.#carry.children.length < Math.min(state.carry, 12)) {
      const m = meat(0.8);
      m.position.y = this.#carry.children.length * 0.022;
      m.rotation.y = this.#carry.children.length * 0.9;
      this.#carry.add(m);
    }
    while (this.#carry.children.length > Math.min(state.carry, 12)) this.#carry.remove(this.#carry.children.at(-1)!);

    this.#sync(this.#animals, state.animals, (a) => {
      const g = a.kind === 'bear' ? bear() : rabbit();
      g.scale.setScalar(CampWorld.CHARACTER);
      return g;
    });
    for (const [a, g] of this.#animals) {
      const dx = a.tx - a.x;
      const dz = a.ty - a.y;
      const turn = Math.atan2(dx, dz);
      g.rotation.y += (((turn - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
      const hop =
        a.kind === 'rabbit' ? Math.abs(Math.sin(now * 9 + a.x * 7)) * 0.02 : Math.abs(Math.sin(now * 5 + a.x)) * 0.004;
      g.position.set(a.x, 0.02 + hop, a.y);
      // 攻撃を受けたら赤く光らせる代わりに、少し縮めて震わせる
      g.scale.setScalar(CampWorld.CHARACTER * (a.flash > 0 ? 0.88 : 1));
      g.position.x += a.flash > 0 ? Math.sin(now * 80) * 0.006 : 0;
    }

    this.#sync(this.#drops, state.drops, () => meat());
    for (const [d, g] of this.#drops) {
      const drop = d as { x: number; y: number };
      g.position.set(drop.x, 0.035 + Math.abs(Math.sin(now * 5 + drop.x * 9)) * 0.012, drop.y);
      g.rotation.y = now * 1.5 + drop.x * 10;
    }

    while (this.#guests.length < state.guests) {
      const p = person('#b27bff', '#58c46b').group;
      p.scale.setScalar(CampWorld.CHARACTER);
      this.#guests.push(p);
      this.scene.add(p);
    }
    while (this.#guests.length > state.guests) this.scene.remove(this.#guests.pop()!);
    this.#guests.forEach((g, i) => {
      const eating = state.meals > 0 && i === 0;
      g.position.set(TABLE.x + 0.17 + i * 0.09, 0.02 + (eating ? Math.abs(Math.sin(now * 10)) * 0.01 : 0), TABLE.y);
      g.rotation.y = -Math.PI / 2 + (eating ? 0 : Math.sin(now * 40 + i) * 0.08);
    });

    while (this.#meals.children.length < Math.min(state.meals, 6)) {
      const i = this.#meals.children.length;
      const bowl = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.014, 14), mat('#ffffff'));
      const stew = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 14), mat('#c2542b'));
      stew.position.y = 0.006;
      bowl.add(cup, stew);
      bowl.position.set(-0.06 + (i % 3) * 0.06, 0, i < 3 ? -0.015 : 0.02);
      this.#meals.add(bowl);
    }
    while (this.#meals.children.length > Math.min(state.meals, 6)) this.#meals.remove(this.#meals.children.at(-1)!);

    while (this.#coins.children.length < Math.min(state.coins, 30)) {
      const i = this.#coins.children.length;
      const c = coin();
      c.position.set(((i % 5) - 2) * 0.028, Math.floor(i / 5) * 0.006, 0);
      this.#coins.add(c);
    }
    while (this.#coins.children.length > Math.min(state.coins, 30)) this.#coins.remove(this.#coins.children.at(-1)!);

    for (const [id, b] of this.#badges) {
      b.rotation.y = now * 1.2;
      b.position.y = 0.12 + Math.sin(now * 3 + b.position.x) * 0.01 + (state.wallet > 0 && id !== 'home' ? 0.01 : 0);
    }

    const flicker = 1 + Math.sin(now * 11) * 0.1 + Math.sin(now * 17) * 0.08;
    this.#flames.forEach((f, i) => f.scale.set(1, flicker * (1 + (state.cooking > 0 ? 0.3 : 0)) - i * 0.05, 1));
    this.#fireLight.intensity = (state.cooking > 0 ? 1.2 : 0.7) * flicker;

    // カメラは主人公を少し遅れて追いかける。雪原の外が映りすぎないよう、見る点は内側に留める
    const tx = Math.min(WORLD_W - 0.55, Math.max(0.55, hero.x));
    const tz = Math.min(WORLD_H - 0.35, hero.y);
    this.#focus.lerp(new THREE.Vector3(tx, 0, tz), Math.min(1, dt * 5));
    this.camera.position.set(this.#focus.x, CAM_UP, this.#focus.z + CAM_BACK);
    this.camera.lookAt(this.#focus.x, 0, this.#focus.z - 0.25);
    this.#sun.position.set(this.#focus.x + 0.6, 2, this.#focus.z + 1);
    this.#sun.target.position.set(this.#focus.x, 0, this.#focus.z - 0.3);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** 雪原の (x, y) の高さ z を、画面のピクセルと、そこでの雪原 1 あたりのピクセル数へ */
  project(x: number, y: number, z: number, w: number, h: number): [number, number, number] {
    const p = new THREE.Vector3(x, z, y).project(this.camera);
    const q = new THREE.Vector3(x + 0.1, z, y).project(this.camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, (Math.abs(q.x - p.x) / 2) * w * 10];
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
