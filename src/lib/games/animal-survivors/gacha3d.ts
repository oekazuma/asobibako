import * as THREE from 'three';
import { GEAR_ART } from './art/gear';
import { pulse } from './draw-boss';
import { cue, glowOf, type Show } from './gacha-show';
import {
  beamFade,
  bolt,
  burst,
  capsuleAt,
  darkness,
  itemScale,
  itemShown,
  LIFT,
  machine,
  openFrac,
  RARITY_COLOR,
  slotOf,
  TIER
} from './gacha3d-parts';
import { parseKey } from './gear';
import { bake } from './pixels';

export { beamFade, capsuleAt, darkness, itemScale, itemShown, machine, slotOf, TIER } from './gacha3d-parts';

/** 画面の何分の 1 の細かさで描くか。拡大するときはぼかさないので、ドット絵と同じ粗さになる */
const COARSE = 3;
const SPARKS = 60;
const HEMI = 2.2;
const BG = new THREE.Color('#2a2240');
const BG_DARK = new THREE.Color('#07050c');
const SUN = 2;

const glow = (opacity = 0) =>
  new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

const pixelTexture = (canvas: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export class GachaScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  readonly #hemi = new THREE.HemisphereLight('#fff3e0', '#3a3256', HEMI);
  readonly #sun = new THREE.DirectionalLight('#ffffff', SUN);
  /** 稲妻のとき、暗くした部屋で機械を上から照らす金の明かり */
  readonly #spot = new THREE.PointLight('#ffd84a', 0, 6);
  readonly #bg = BG.clone();
  /** 金の粒が降る場所。消えていくあいだは前のカプセルの上に残す */
  readonly #sparkAt = new THREE.Vector3();
  readonly #m = machine();
  readonly #beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 3, 10, 1, true), glow());
  readonly #rays = [new THREE.Mesh(burst(12, 0.95), glow()), new THREE.Mesh(burst(9, 1.3), glow())];
  readonly #bolts = [new THREE.Mesh(bolt(1), glow()), new THREE.Mesh(bolt(4), glow())];
  /** 割れるときに機械の前へ下ろす暗い幕（品と光を目立たせる）。濃さはなめらかに追いかける */
  readonly #dim = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({ color: '#120e20', transparent: true, opacity: 0, depthWrite: false })
  );
  readonly #sparks: THREE.Points;
  readonly #items: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  #size = { w: 1, h: 1 };
  #gears = '';

  constructor(canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.#renderer.setPixelRatio(1);
    this.#scene.background = this.#bg;
    this.#sun.position.set(1.5, 3, 2.5);
    this.#spot.position.set(0, 2.5, 1.2);
    for (const b of this.#bolts) b.position.z = 0.7;
    this.#dim.position.z = 0.85;
    const pts = new Float32Array(SPARKS * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.#sparks = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: RARITY_COLOR[2], size: 0.05, transparent: true, opacity: 0, depthWrite: false })
    );
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
      );
      this.#items.push(p);
    }
    this.#scene.add(
      this.#hemi,
      this.#sun,
      this.#spot,
      this.#m.group,
      this.#dim,
      this.#beam,
      ...this.#rays,
      ...this.#bolts
    );
    this.#scene.add(this.#sparks, ...this.#items);
    // 暗い幕より後に描く（透けるものの並べ替えに任せると、幕の下に入って暗くなることがある）
    for (const o of [this.#beam, ...this.#rays, this.#sparks, ...this.#items]) o.renderOrder = 1;
    this.#sparks.frustumCulled = false;
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
    this.#ensureItems(s);
    this.#machine(s, now);
    this.#capsules(s, now);
    this.#reveal(s, now);
    this.#renderer.render(this.#scene, this.#camera);
  }

  /** 回すあいだの揺れ（確定演出の強さで大きく）と、稲妻の暗転 */
  #machine(s: Show, now: number): void {
    const m = this.#m;
    const c = cue(s);
    m.handle.rotation.z = -s.angle;
    const shaking = s.phase === 'spin' ? c * 0.012 : 0;
    m.group.position.x = Math.sin(now * 45) * shaking;
    const stir = s.phase === 'spin' ? 1 : 0;
    m.inside.children.forEach((g, i) => {
      const home = g.userData.home as THREE.Vector3;
      g.position.set(home.x, home.y + stir * Math.abs(Math.sin(now * 18 + i)) * 0.08, home.z);
      if (stir) g.rotation.y += 0.25;
    });
    const storm = s.phase === 'storm';
    const dark = darkness(s);
    this.#hemi.intensity = HEMI * (1 - 0.85 * dark);
    this.#sun.intensity = SUN * (1 - 0.9 * dark);
    this.#bg.copy(BG).lerp(BG_DARK, dark);
    this.#spot.intensity = dark * 4;
    const base = m.base.material as THREE.MeshStandardMaterial;
    base.emissive.set(RARITY_COLOR[2]);
    base.emissiveIntensity = dark * 0.15;
    // 稲妻は 2 回、なめらかに強めて弱める（1 フレームごとに切り替えるとチカチカする）
    const strike = (at: number) => (storm ? Math.max(0, 1 - Math.abs(s.t - at) / 0.28) : 0);
    this.#bolts[0].material.opacity = strike(0.3);
    this.#bolts[1].material.opacity = strike(0.75);
    for (const b of this.#bolts) b.material.color.set('#fff3b0');
  }

  #capsules(s: Show, now: number): void {
    const n = s.gears.length;
    this.#m.capsules.forEach((c, i) => {
      c.group.visible = i < n;
      if (i >= n) return;
      const at = capsuleAt(s, i);
      const shaking = s.phase === 'crack' && i === s.opened ? Math.sin(s.t * 40) * 0.02 : 0;
      c.group.position.set(at.x + shaking, at.y, at.z);
      c.group.scale.setScalar(n === 1 ? 1 + Math.min(1, at.open * 2) * 0.5 : 0.7);
      // 割れたら上は跳ね上がり、下は落ちて、品の前から消える
      const fly = Math.max(0, at.open * 2 - 1);
      c.top.position.set(-fly * 0.25, at.open * 0.12 + fly * 0.5, 0);
      c.bottom.position.set(fly * 0.2, -at.open * 0.12 - fly * 0.45, 0);
      c.top.rotation.z = -at.open * 0.6 - fly * 1.2;
      c.bottom.rotation.z = fly * 0.8;
      c.top.visible = c.bottom.visible = at.open < 1;
      const g = glowOf(s, i);
      const lit = g > 0 && s.phase !== 'ready' && s.phase !== 'spin' && s.phase !== 'storm';
      c.top.material.emissive.set(RARITY_COLOR[g]);
      c.top.material.emissiveIntensity = lit ? 0.6 + 0.3 * pulse(now) : 0;
    });
  }

  /** 割れるときの光の柱・筋・幕・金の粒と、品の板。豪華さはレア度の段（TIER）で決める */
  #reveal(s: Show, now: number): void {
    const n = s.gears.length;
    const after = s.phase === 'show' || s.phase === 'list' || s.phase === 'done';
    const opening = s.phase === 'open' && s.opened < n;
    const i = opening ? s.opened : Math.min(n - 1, s.opened);
    const r = n === 1 || opening ? s.rarity[i] : (Math.max(...s.rarity) as 0 | 1 | 2);
    const tier = TIER[r];
    const u = opening ? openFrac(s) : after ? 1 : 0;
    const lit = opening || (after && n === 1);
    const at = n === 1 ? LIFT : slotOf(i, n);
    const dim = this.#dim.material as THREE.MeshBasicMaterial;
    // 10 連のカプセルは手前に並ぶので、幕はその後ろ（機械の前の面のすぐ手前）に下ろす
    this.#dim.position.z = n === 1 ? 0.85 : 0.55;
    const target =
      s.phase === 'list' || s.phase === 'done' ? (n > 1 ? 0.8 : tier.dim) : lit ? tier.dim * Math.min(1, u * 1.5) : 0;
    dim.opacity += (target - dim.opacity) * 0.15;
    this.#beam.material.color.set(RARITY_COLOR[r]);
    this.#beam.material.opacity = lit ? tier.beam * u * beamFade(n, u) : 0;
    this.#beam.scale.set(tier.width, 1, tier.width);
    this.#beam.position.set(at.x, at.y + 1.3, at.z - 0.05);
    this.#beam.rotation.y = now * 0.6;
    this.#rays.forEach((ray, k) => {
      ray.material.color.set(RARITY_COLOR[r]);
      const fade = Math.min(1, Math.max(0, (u - 0.4) / 0.2)) * beamFade(n, u);
      ray.material.opacity = lit && k < tier.rays ? (0.3 + 0.1 * Math.sin(now * 3)) * fade : 0;
      ray.position.set(at.x, at.y + (n === 1 ? 0.35 : 0.3), at.z + 0.05);
      ray.rotation.z = now * (k ? -0.7 : 1.1);
      ray.scale.setScalar(n === 1 ? 1 : 0.5);
    });
    const sparking = lit && tier.sparks > 0;
    if (sparking) this.#sparkAt.copy(at);
    this.#fallSparks(sparking, this.#sparkAt, now);
    this.#items.forEach((p, k) => {
      p.visible = itemShown(s, k);
      if (!p.visible) return;
      const big = n === 1;
      const size = big ? itemScale(s) : 0.17;
      const spot = big ? LIFT : slotOf(k, n);
      p.scale.setScalar(size);
      p.position.set(spot.x, spot.y + (big ? 0.35 + Math.sin(now * 2.5) * 0.03 : 0.25), spot.z + (big ? 0.3 : 0.15));
    });
  }

  #fallSparks(on: boolean, at: THREE.Vector3, now: number): void {
    const mat = this.#sparks.material as THREE.PointsMaterial;
    mat.opacity += ((on ? 0.9 : 0) - mat.opacity) * 0.1;
    if (mat.opacity < 0.01) return;
    const pos = this.#sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < SPARKS; k++) {
      const fall = (now * (0.4 + (k % 7) * 0.08) + k * 0.37) % 1;
      const a = k * 2.39996;
      pos.setXYZ(k, at.x + Math.cos(a) * 0.6 * ((k % 5) / 5 + 0.2), at.y + 1.6 - fall * 1.8, at.z + Math.sin(a) * 0.2);
    }
    pos.needsUpdate = true;
  }

  /** 品の板の絵は、引いた品が変わったときだけ作り直す */
  #ensureItems(s: Show): void {
    const key = s.gears.join(',');
    if (key === this.#gears) return;
    this.#gears = key;
    this.#items.forEach((p, k) => {
      p.material.map?.dispose();
      const g = parseKey(s.gears[k] ?? '');
      p.material.map = g ? pixelTexture(bake(GEAR_ART[g.def.id])) : null;
      p.material.needsUpdate = true;
    });
  }

  /** ハンドルの中心の、canvas の CSS ピクセルの座標 */
  handle(): { x: number; y: number } {
    const v = this.#m.handle.getWorldPosition(new THREE.Vector3()).project(this.#camera);
    return { x: ((v.x + 1) / 2) * this.#size.w, y: ((1 - v.y) / 2) * this.#size.h };
  }

  dispose(): void {
    this.#scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
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
