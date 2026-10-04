import * as THREE from 'three';
import { GEAR_ART } from './art/gear';
import { DROP, OPEN, type Show } from './gacha-show';
import { parseKey } from './gear';
import { bake } from './pixels';

export const RARITY_COLOR = ['#fff8ec', '#5ab0ff', '#ffd84a'];
const CAPSULE_COLORS = ['#d8463c', '#2a64c8', '#ffd84a', '#56a03c', '#f093a3'];
/** 画面の何分の 1 の細かさで描くか。拡大するときはぼかさないので、ドット絵と同じ粗さになる */
const COARSE = 3;
const CAPSULE_R = 0.13;
/** 取り出し口と、割れるときに持ち上がる先 */
const OUTLET = new THREE.Vector3(0.34, 0.2, 0.62);
const LIFT = new THREE.Vector3(0, 0.75, 1.1);

const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, ...extra });

/** 上が色・下が白のカプセル。半球を 2 つ重ね、割れるときは上下に離す */
function capsule(color: string): { group: THREE.Group; top: THREE.Mesh; bottom: THREE.Mesh } {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(CAPSULE_R, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat(color));
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(CAPSULE_R, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    flat('#fff8ec')
  );
  group.add(top, bottom);
  return { group, top, bottom };
}

export function machine() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), flat('#d8463c'));
  base.name = 'base';
  base.position.y = 0.45;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 12), flat('#8e2430'));
  neck.name = 'neck';
  neck.position.y = 0.96;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 16, 12),
    new THREE.MeshPhysicalMaterial({
      color: '#d8f0ff',
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      flatShading: true
    })
  );
  dome.name = 'dome';
  dome.position.y = 1.45;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 10), flat('#8e2430'));
  cap.position.y = 2.1;
  // 中のカプセルは球の下半分を中心に、重ならないよう黄金角でまく
  const inside = new THREE.Group();
  inside.name = 'inside';
  for (let i = 0; i < 14; i++) {
    const c = capsule(CAPSULE_COLORS[i % CAPSULE_COLORS.length]).group;
    const a = i * 2.39996;
    const r = 0.18 + 0.26 * ((i * 0.37) % 1);
    c.position.set(Math.cos(a) * r, 1.15 + (i % 3) * 0.17, Math.sin(a) * r);
    c.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    c.userData.home = c.position.clone();
    inside.add(c);
  }
  const handle = new THREE.Group();
  handle.name = 'handle';
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), flat('#fff8ec'));
  disc.rotation.x = Math.PI / 2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), flat('#bcc4ce'));
  grip.position.z = 0.06;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), flat('#ffd84a'));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.15, 0, 0.12);
  handle.add(disc, grip, knob);
  handle.position.set(-0.22, 0.55, 0.47);
  const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.08), flat('#24151f'));
  outlet.position.set(OUTLET.x, 0.2, 0.43);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.26), flat('#8e2430'));
  lip.position.set(OUTLET.x, 0.06, 0.56);
  const out = capsule(CAPSULE_COLORS[0]);
  group.add(base, neck, dome, cap, inside, handle, outlet, lip, out.group);
  return { group, handle, inside, capsule: out.group, top: out.top, bottom: out.bottom };
}

/** 中心から放射する細い光の筋（n 本、長さ len） */
function burst(n: number, len: number): THREE.BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 0.07;
    pts.push(0, 0, 0, Math.cos(a - w) * len, Math.sin(a - w) * len, 0, Math.cos(a + w) * len, Math.sin(a + w) * len, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const ease = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

/** 転がるカプセルの位置（台の中 → 取り出し口 → 割れながら持ち上がる）と割れ具合 */
export function capsuleAt(s: Show): { x: number; y: number; z: number; open: number } {
  if (s.phase === 'ready' || s.phase === 'spin') return { x: OUTLET.x, y: 0.5, z: 0.1, open: 0 };
  if (s.phase === 'drop') {
    const u = ease(s.t / DROP);
    // 転がり出るときに 1 度だけ小さく弾む
    const hop = Math.sin(Math.min(1, s.t / DROP) * Math.PI) * 0.08;
    return { x: OUTLET.x, y: 0.5 + (OUTLET.y - 0.5) * u + hop * (1 - u), z: 0.1 + (OUTLET.z - 0.1) * u, open: 0 };
  }
  if (s.phase === 'wait') return { x: OUTLET.x, y: OUTLET.y, z: OUTLET.z, open: 0 };
  const open = s.phase === 'open' ? Math.min(1, s.t / OPEN) : 1;
  const p = OUTLET.clone().lerp(LIFT, ease(open * 1.6));
  return { x: p.x, y: p.y, z: p.z, open };
}

export class GachaScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  readonly #m = machine();
  readonly #beam: THREE.Mesh;
  readonly #item: THREE.Mesh;
  readonly #rays: THREE.Mesh;
  /** 品を見せるときに機械の前へ下ろす暗い幕（品と光を目立たせる） */
  readonly #dim: THREE.Mesh;
  #size = { w: 1, h: 1 };
  #shown: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.#renderer.setPixelRatio(1);
    this.#scene.background = new THREE.Color('#2a2240');
    this.#scene.add(new THREE.HemisphereLight('#fff3e0', '#3a3256', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(1.5, 3, 2.5);
    this.#scene.add(sun, this.#m.group);
    const glow = (color: string, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    this.#beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 3, 10, 1, true), glow('#ffffff', 0));
    this.#rays = new THREE.Mesh(burst(12, 0.95), glow('#ffffff', 0));
    this.#dim = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: '#120e20', transparent: true, opacity: 0, depthWrite: false })
    );
    this.#dim.position.z = 0.85;
    this.#item = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
    );
    this.#scene.add(this.#dim, this.#beam, this.#rays, this.#item);
    this.#camera.position.set(0.35, 1.25, 4.4);
    this.#camera.lookAt(0, 0.95, 0);
  }

  resize(w: number, h: number): void {
    this.#size = { w, h };
    this.#renderer.setSize(Math.ceil(w / COARSE), Math.ceil(h / COARSE), false);
    this.#camera.aspect = w / h;
    // 縦長の画面でも機械の幅が入るよう、横の見える幅から縦の画角を決める
    this.#camera.fov = Math.min(60, Math.max(35, 35 / Math.min(1, this.#camera.aspect * 1.4)));
    this.#camera.updateProjectionMatrix();
  }

  render(s: Show, now: number): void {
    const m = this.#m;
    const rarity = parseKey(s.gear)?.rarity ?? 0;
    m.handle.rotation.z = -s.angle;
    // 回しているあいだだけ、中のカプセルがかき混ぜられて跳ねる
    const stir = s.phase === 'spin' ? 1 : 0;
    m.inside.children.forEach((c, i) => {
      const home = c.userData.home as THREE.Vector3;
      c.position.set(home.x, home.y + stir * Math.abs(Math.sin(now * 18 + i)) * 0.08, home.z);
      if (stir) c.rotation.y += 0.25;
    });
    const at = capsuleAt(s);
    m.capsule.position.set(at.x, at.y, at.z);
    m.capsule.scale.setScalar(1 + Math.min(1, at.open * 2) * 0.5);
    // 割れたら上は跳ね上がり、下は落ちて、品の前から消える
    const fly = Math.max(0, at.open * 2 - 1);
    m.top.position.set(-fly * 0.25, at.open * 0.12 + fly * 0.5, 0);
    m.bottom.position.set(fly * 0.2, -at.open * 0.12 - fly * 0.45, 0);
    m.top.rotation.z = -at.open * 0.6 - fly * 1.2;
    m.bottom.rotation.z = fly * 0.8;
    const after = s.phase === 'show' || s.phase === 'done';
    m.capsule.visible = !after;
    const lit = s.phase === 'open' || after;
    (this.#dim.material as THREE.MeshBasicMaterial).opacity = lit ? 0.75 * Math.min(1, at.open * 1.5) : 0;
    const beam = this.#beam.material as THREE.MeshBasicMaterial;
    beam.color.set(RARITY_COLOR[rarity]);
    beam.opacity = lit ? 0.25 * at.open : 0;
    this.#beam.position.set(at.x, at.y + 1.3, at.z - 0.05);
    this.#beam.rotation.y = now * 0.6;
    const rays = this.#rays.material as THREE.MeshBasicMaterial;
    rays.color.set(RARITY_COLOR[rarity]);
    rays.opacity = after ? 0.3 + 0.1 * Math.sin(now * 3) : 0;
    this.#rays.position.set(LIFT.x, LIFT.y + 0.35, LIFT.z + 0.05);
    this.#rays.rotation.z = now * (rarity === 2 ? 1.2 : 0.5);
    this.#rays.scale.setScalar(rarity === 2 ? 1.3 : 1);
    this.#showItem(s, now);
    this.#renderer.render(this.#scene, this.#camera);
  }

  #showItem(s: Show, now: number): void {
    const mat = this.#item.material as THREE.MeshBasicMaterial;
    const p = parseKey(s.gear);
    if (p && this.#shown !== s.gear) {
      mat.map?.dispose();
      const tex = new THREE.CanvasTexture(bake(GEAR_ART[p.def.id]));
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.needsUpdate = true;
      this.#shown = s.gear;
    }
    this.#item.visible = s.phase === 'show' || s.phase === 'done';
    // 出てきた瞬間に小さく弾んで大きくなる
    const u = Math.min(1, s.t / 0.25);
    this.#item.scale.setScalar(s.phase === 'show' ? 0.4 + 0.6 * u + Math.sin(u * Math.PI) * 0.15 : 1);
    this.#item.position.set(LIFT.x, LIFT.y + 0.35 + Math.sin(now * 2.5) * 0.03, LIFT.z + 0.3);
  }

  /** ハンドルの中心の、canvas の CSS ピクセルの座標 */
  handle(): { x: number; y: number } {
    const v = this.#m.handle.getWorldPosition(new THREE.Vector3()).project(this.#camera);
    return { x: ((v.x + 1) / 2) * this.#size.w, y: ((1 - v.y) / 2) * this.#size.h };
  }

  dispose(): void {
    this.#scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mt of mats) {
        (mt as THREE.MeshBasicMaterial).map?.dispose();
        mt.dispose();
      }
    });
    this.#renderer.dispose();
    // dispose だけでは WebGL の場が残り、何度も開くと端末の上限に届く
    this.#renderer.forceContextLoss();
  }
}
