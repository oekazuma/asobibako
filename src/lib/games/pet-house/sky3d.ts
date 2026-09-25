import * as THREE from 'three';
import type { Daylight } from './daytime';
import { box, cyl, mesh } from './props';
import { canvas, once, seeded, texture } from './textures';

/**
 * 空・星・雨と雪・明かりの 3D。時刻と天気（daytime.ts）を映すだけで、場面の組み立てには口を出さない。
 * 雨と雪は 1 つの Points、星も 1 つの Points にして、描く回数を増やさない
 */

const tex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) =>
  once(key, () => texture(canvas(w, h, draw), true, repeat));

const dot = (g: CanvasRenderingContext2D, s: number, inner: string) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, inner);
  r.addColorStop(1, 'rgb(255 255 255 / 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
};

export const glowMap = () => tex('sky:glow', 64, 64, (g) => dot(g, 64, 'rgb(255 255 255 / 1)'));
const flakeMap = () => tex('sky:flake', 32, 32, (g) => dot(g, 32, 'rgb(255 255 255 / 1)'));
/** 雨つぶは正方形の点の中の細い縦の筋 */
const streakMap = () =>
  tex('sky:streak', 16, 64, (g) => {
    const l = g.createLinearGradient(0, 0, 0, 64);
    l.addColorStop(0, 'rgb(255 255 255 / 0)');
    l.addColorStop(1, 'rgb(255 255 255 / 0.9)');
    g.fillStyle = l;
    g.fillRect(6.5, 0, 3, 64);
  });

/** 明かりのガラス（ランプのかさ・街灯）。夜だけ光る。場面をまたいで 1 つを使い、release() に捨てさせない */
export const lampGlass = new THREE.MeshStandardMaterial({
  color: '#fff3dc',
  emissive: '#ffbe6a',
  emissiveIntensity: 0,
  roughness: 0.6,
  // ランプのかさは筒なので、上から見える内側も塗る
  side: THREE.DoubleSide
});
/** 明かりの足元や壁に落ちる、ぼんやりした明るい丸 */
export const lampPool = new THREE.MeshBasicMaterial({
  color: '#ffc878',
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4
});
lampGlass.userData.shared = lampPool.userData.shared = true;

/** 地面に落ちる明かりの丸。r はメートル */
export function pool(x: number, z: number, r: number) {
  lampPool.map ??= glowMap();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), lampPool);
  // 歩道の板石（上面 0.06）より上に置く
  m.position.set(x, 0.065, z);
  m.renderOrder = 2;
  return m;
}

/** 公園の街灯。黒い柱の上に丸い灯り */
export function streetLamp(x: number, z: number) {
  const g = new THREE.Group();
  const iron = '#2f3338';
  g.add(mesh(cyl(0.05, 0.07, 3, 10), iron, 0, 1.5, 0));
  g.add(mesh(box(0.34, 0.06, 0.34), iron, 0, 3.02, 0, false));
  g.add(mesh(cyl(0.12, 0.09, 0.3, 12), lampGlass, 0, 2.84, 0, false));
  g.add(mesh(cyl(0.06, 0.12, 0.1, 12), iron, 0, 2.66, 0, false));
  g.position.set(x, 0, z);
  g.add(pool(0, 0, 1.6));
  return g;
}

/** 空のドームの絵を、時刻の色で描き直す。scenes.ts の skyDome() のドームに名前 'sky' が付いている */
export function paintDome(dome: THREE.Object3D, d: Daylight) {
  const map = ((dome as THREE.Mesh).material as THREE.MeshBasicMaterial).map;
  const c = map?.image as HTMLCanvasElement | undefined;
  const g = c?.getContext('2d');
  if (!map || !c || !g) return;
  const s = g.createLinearGradient(0, 0, 0, c.height);
  s.addColorStop(0, d.sky[0]);
  s.addColorStop(0.4, d.sky[1]);
  s.addColorStop(0.5, d.sky[2]);
  s.addColorStop(1, d.sky[2]);
  g.fillStyle = s;
  g.fillRect(0, 0, c.width, c.height);
  map.needsUpdate = true;
}

const RAIN = { n: 1400, fall: 7.5, size: 0.36 };
const SNOW = { n: 1200, fall: 0.9, size: 0.055 };
/** 雨と雪を降らせる箱。カメラの前 AHEAD m を中心に、横 W・奥 D・高さ H */
const BOX = { w: 12, d: 14, h: 7, ahead: 5 };

/** 外の場面の星・雨と雪・積もった雪（ぬれた地面）。world3d が 1 つ持ち、場面が変わっても使い回す */
export class SkyFx {
  readonly group = new THREE.Group();
  readonly #stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly #drops: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  readonly #cover: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  #kind: 'rain' | 'snow' | null = null;
  #t = 0;
  readonly #at = new THREE.Vector3();

  constructor() {
    const rnd = seeded(11);
    const stars: number[] = [];
    for (let i = 0; i < 360; i++) {
      const a = rnd() * Math.PI * 2;
      const up = 0.12 + rnd() * 0.88;
      const r = Math.sqrt(1 - up * up);
      stars.push(Math.cos(a) * r * 26, up * 26, Math.sin(a) * r * 26);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    this.#stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: '#fff8e0',
        size: 3,
        sizeAttenuation: false,
        map: flakeMap(),
        transparent: true,
        depthWrite: false,
        fog: false
      })
    );
    this.#stars.frustumCulled = false;

    const n = Math.max(RAIN.n, SNOW.n);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * BOX.w;
      pos[i * 3 + 1] = rnd() * BOX.h;
      pos[i * 3 + 2] = (rnd() - 0.5) * BOX.d;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.#drops = new THREE.Points(dg, new THREE.PointsMaterial({ transparent: true, depthWrite: false }));
    this.#drops.frustumCulled = false;

    // 芝より少しだけ上の 1 枚。芝の葉が突き抜けて雪をかぶったように見え、少し高い道や縁石には掛からない
    this.#cover = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    this.#cover.position.y = 0.003;
    this.#cover.receiveShadow = true;
    this.group.add(this.#stars, this.#drops, this.#cover);
  }

  set(d: Daylight, outdoor: boolean): void {
    this.#stars.visible = outdoor && d.stars > 0.02;
    this.#stars.material.opacity = d.stars;
    const kind = outdoor && (d.weather === 'rain' || d.weather === 'snow') ? d.weather : null;
    this.#kind = kind;
    this.#drops.visible = !!kind;
    this.#cover.visible = !!kind;
    if (!kind) return;
    const spec = kind === 'rain' ? RAIN : SNOW;
    const m = this.#drops.material;
    m.map = kind === 'rain' ? streakMap() : flakeMap();
    m.size = spec.size;
    m.color.set(kind === 'rain' ? '#e4ecf6' : '#ffffff');
    m.opacity = kind === 'rain' ? 0.75 : 0.95;
    m.needsUpdate = true;
    this.#drops.geometry.setDrawRange(0, spec.n);
    const c = this.#cover.material;
    c.color.set(kind === 'snow' ? '#f4f8ff' : '#26303a');
    c.opacity = kind === 'snow' ? 0.6 : 0.22;
  }

  /** 降るものを落とし、カメラのまわりへ戻す。dt で進めるので、描く回数を減らしても降る速さは同じ */
  step(dt: number, camera: THREE.Camera): void {
    this.#stars.position.copy(camera.position);
    const kind = this.#kind;
    if (!kind) return;
    this.#t += dt;
    const fwd = camera.getWorldDirection(this.#at);
    fwd.y = 0;
    fwd.normalize();
    const cx = camera.position.x + fwd.x * BOX.ahead;
    const cz = camera.position.z + fwd.z * BOX.ahead;
    this.#cover.position.set(Math.round(cx), 0.003, Math.round(cz));
    const p = this.#drops.geometry.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const spec = kind === 'rain' ? RAIN : SNOW;
    const wrap = (v: number, c: number, span: number) => c + ((((v - c + span / 2) % span) + span) % span) - span / 2;
    for (let i = 0; i < spec.n; i++) {
      let y = a[i * 3 + 1] - spec.fall * dt;
      if (y < 0) y += BOX.h;
      a[i * 3 + 1] = y;
      // 雪は 1 つずつ違う速さで左右に揺れる
      const sway = kind === 'snow' ? Math.sin(this.#t * 0.8 + i) * 0.25 * dt : 0;
      a[i * 3] = wrap(a[i * 3] + sway, cx, BOX.w);
      a[i * 3 + 2] = wrap(a[i * 3 + 2], cz, BOX.d);
    }
    p.needsUpdate = true;
  }

  dispose(): void {
    for (const o of [this.#stars, this.#drops, this.#cover]) {
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

/** 窓の外に降る雨・雪と、ガラスの雨つぶ・星。部屋の窓の絵の手前に重ねる */
export const windowRain = () =>
  tex(
    'sky:window-rain',
    128,
    256,
    (g) => {
      const rnd = seeded(5);
      g.strokeStyle = 'rgb(235 242 255 / 0.55)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 128;
        const y = rnd() * 256;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 3, y + 18 + rnd() * 14);
        g.stroke();
      }
    },
    true
  );

export const windowSnow = () =>
  tex(
    'sky:window-snow',
    128,
    128,
    (g) => {
      const rnd = seeded(9);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        g.beginPath();
        g.arc(rnd() * 128, rnd() * 128, 1.2 + rnd() * 2.2, 0, Math.PI * 2);
        g.fill();
      }
    },
    true
  );

export const glassDrops = () =>
  tex('sky:glass-drops', 256, 256, (g) => {
    const rnd = seeded(21);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 1.5 + rnd() * 3.5;
      g.fillStyle = 'rgb(200 215 235 / 0.5)';
      g.beginPath();
      g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgb(255 255 255 / 0.85)';
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.4, r * 0.35, 0, Math.PI * 2);
      g.fill();
      // 流れた跡
      if (rnd() < 0.25) {
        g.fillStyle = 'rgb(210 225 240 / 0.35)';
        g.fillRect(x - 0.6, y - 20 - rnd() * 30, 1.2, 20);
      }
    }
  });

export const windowStars = () =>
  tex('sky:window-stars', 256, 256, (g) => {
    const rnd = seeded(31);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgb(255 250 230 / ${0.5 + rnd() * 0.5})`;
      const s = rnd() < 0.15 ? 3 : 1.6;
      g.fillRect(rnd() * 256, rnd() * 170, s, s);
    }
  });
