import * as THREE from 'three';
import { DROP, OPEN_TIME, ROLL_GAP, type Show } from './gacha-show';

export const RARITY_COLOR = ['#fff8ec', '#5ab0ff', '#ffd84a'];
const CAPSULE_COLORS = ['#d8463c', '#2a64c8', '#ffd84a', '#56a03c', '#f093a3'];
const CAPSULE_R = 0.13;
/** 取り出し口と、1 こ引きで割れるときに持ち上がる先 */
export const OUTLET = new THREE.Vector3(0.34, 0.2, 0.62);
export const LIFT = new THREE.Vector3(0, 0.75, 1.1);
/** 台の中の、転がり出る前の場所 */
const INSIDE = new THREE.Vector3(0.34, 0.5, 0.1);

/** 割れ方の豪華さ。光の柱の濃さと太さ、光の筋の枚数、暗い幕の濃さ、金の粒の数 */
export const TIER = [
  { beam: 0.22, width: 0.08, rays: 0, dim: 0, sparks: 0 },
  { beam: 0.32, width: 0.12, rays: 1, dim: 0.45, sparks: 0 },
  { beam: 0.55, width: 0.2, rays: 2, dim: 0.85, sparks: 60 }
];

export const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, ...extra });

export interface Capsule {
  group: THREE.Group;
  top: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  bottom: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
}

/** 上が色・下が白のカプセル。半球を 2 つ重ね、割れるときは上下に離す */
function capsule(color: string): Capsule {
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
  const capsules = Array.from({ length: 10 }, (_, i) => capsule(CAPSULE_COLORS[(i * 2) % CAPSULE_COLORS.length]));
  group.add(base, neck, dome, cap, inside, handle, outlet, lip, ...capsules.map((c) => c.group));
  return { group, base, handle, inside, capsules };
}

/** 中心から放射する細い光の筋（n 本、長さ len） */
export function burst(n: number, len: number): THREE.BufferGeometry {
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

/** 画面の上からガラスの球へ落ちる、折れ曲がった稲妻の板（機械の手前に置く）。seed で折れ方を変える */
export function bolt(seed: number): THREE.BufferGeometry {
  const pts: number[] = [];
  let x = Math.sin(seed) * 0.3;
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const y0 = 2.7 - (i / steps) * 1.25;
    const y1 = 2.7 - ((i + 1) / steps) * 1.25;
    const nx = i === steps - 1 ? 0 : Math.sin(seed * 3.1 + i * 2.3) * 0.3;
    const w = 0.06;
    pts.push(x - w, y0, 0, x + w, y0, 0, nx + w, y1, 0, x - w, y0, 0, nx + w, y1, 0, nx - w, y1, 0);
    x = nx;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** 1 こなら取り出し口。10 こなら手前に 5 こずつ 2 段（後ろの段は少し上げて重ならないように見せる） */
export function slotOf(i: number, n: number): THREE.Vector3 {
  if (n === 1) return OUTLET.clone();
  const col = i % 5;
  const row = Math.floor(i / 5);
  return new THREE.Vector3(-0.56 + col * 0.28, 0.1 + row * 0.26, 0.78 - row * 0.1);
}

const ease = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

/** i 番めのカプセルの位置と割れ具合 0〜1 */
export function capsuleAt(s: Show, i: number): { x: number; y: number; z: number; open: number } {
  const n = s.gears.length;
  const slot = slotOf(i, n);
  const at = (p: THREE.Vector3, open = 0) => ({ x: p.x, y: p.y, z: p.z, open });
  if (s.phase === 'ready' || s.phase === 'spin' || s.phase === 'storm') return at(INSIDE);
  if (s.phase === 'drop') {
    const raw = (s.t - ROLL_GAP * i) / DROP;
    const u = ease(raw);
    // 転がり出るときに 1 度だけ小さく弾む
    const hop = Math.sin(Math.min(1, Math.max(0, raw)) * Math.PI) * 0.08 * (1 - u);
    const p = INSIDE.clone().lerp(slot, u);
    return { x: p.x, y: p.y + hop, z: p.z, open: 0 };
  }
  let open = 0;
  if (i < s.opened || s.phase === 'show' || s.phase === 'list' || s.phase === 'done') open = 1;
  else if (i === s.opened && s.phase === 'open') open = Math.min(1, s.t / OPEN_TIME[s.rarity[i]]);
  if (n > 1) return at(slot, open);
  return at(slot.clone().lerp(LIFT, ease(open * 1.6)), open);
}
