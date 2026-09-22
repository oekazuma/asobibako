import * as THREE from 'three';

/**
 * 雪原の 3D の部品。座標は雪原の単位のまま（x が横、z が雪原の y、y が高さ）。
 * 絵文字や画像は使わず、球・円柱・円すいなどの組み合わせで作る
 */

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    materials.set(key, m);
  }
  return m;
}

function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, extra = {}, shadow = true) {
  const m = new THREE.Mesh(geometry, mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。木 1 本で 7 個、面全体で数百個になるので GPU に上げる回数を減らす */
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const sphere = (r: number) => geo(`sphere:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`cyl:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));

const capsule = (r: number, l: number, cap = 6, rad = 14) =>
  geo(`capsule:${r}:${l}:${cap}:${rad}`, () => new THREE.CapsuleGeometry(r, l, cap, rad));
const torus = (r: number, tube: number, rad = 8, tubular = 18, arc = Math.PI * 2) =>
  geo(`torus:${r}:${tube}:${rad}:${tubular}:${arc}`, () => new THREE.TorusGeometry(r, tube, rad, tubular, arc));

/** 帽子とマフラーの主人公。legs は歩くときに振る */
export function person(coat: string, hat: string) {
  const g = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  for (const dx of [-0.012, 0.012]) {
    const leg = mesh(cyl(0.009, 0.009, 0.035), '#3b3f5c', dx, 0.018, 0);
    legs.push(leg);
    g.add(leg);
  }
  g.add(mesh(capsule(0.024, 0.03), coat, 0, 0.06, 0));
  g.add(mesh(torus(0.018, 0.007), '#ff4d5e', 0, 0.083, 0).rotateX(Math.PI / 2));
  g.add(mesh(sphere(0.022), '#ffd7b5', 0, 0.105, 0));
  for (const dx of [-0.008, 0.008]) g.add(mesh(sphere(0.0035), '#2b2d42', dx, 0.108, 0.02));
  g.add(mesh(cyl(0.004, 0.023, 0.03), hat, 0, 0.13, 0));
  g.add(mesh(sphere(0.008), '#ffffff', 0, 0.147, 0));
  return { group: g, legs };
}

export function bear() {
  const g = new THREE.Group();
  const fur = '#8a5a3b';
  const body = mesh(sphere(0.05), fur, 0, 0.055, 0);
  body.scale.set(1, 0.85, 1.2);
  g.add(body);
  for (const [dx, dz] of [
    [-0.03, -0.035],
    [0.03, -0.035],
    [-0.03, 0.035],
    [0.03, 0.035]
  ])
    g.add(mesh(cyl(0.013, 0.013, 0.03), fur, dx, 0.015, dz));
  g.add(mesh(sphere(0.034), fur, 0, 0.1, 0.05));
  const snout = mesh(sphere(0.016), '#d9b38c', 0, 0.093, 0.08);
  snout.scale.set(1, 0.8, 1);
  g.add(snout);
  g.add(mesh(sphere(0.006), '#2b2d42', 0, 0.098, 0.095));
  for (const dx of [-0.013, 0.013]) g.add(mesh(sphere(0.005), '#2b2d42', dx, 0.11, 0.078));
  for (const dx of [-0.024, 0.024]) g.add(mesh(sphere(0.012), fur, dx, 0.13, 0.045));
  return g;
}

export function rabbit() {
  const g = new THREE.Group();
  const fur = '#e2c9a6';
  const body = mesh(sphere(0.028), fur, 0, 0.03, 0);
  body.scale.set(1, 0.9, 1.15);
  g.add(body);
  g.add(mesh(sphere(0.02), fur, 0, 0.058, 0.025));
  for (const dx of [-0.009, 0.009]) {
    g.add(mesh(capsule(0.006, 0.03, 4, 8), fur, dx, 0.09, 0.02));
    g.add(mesh(sphere(0.004), '#2b2d42', dx * 1.1, 0.062, 0.043));
  }
  g.add(mesh(sphere(0.004), '#ff8fa3', 0, 0.056, 0.045));
  g.add(mesh(sphere(0.01), fur, 0, 0.035, -0.032));
  return g;
}

/** 骨付き肉 */
export function meat(scale = 1) {
  const g = new THREE.Group();
  const chunk = mesh(sphere(0.02), '#c2542b', 0, 0, 0);
  chunk.scale.set(1.3, 1, 1);
  g.add(chunk);
  const bone = mesh(cyl(0.005, 0.005, 0.03), '#fff8ec', 0.03, 0, 0);
  bone.rotation.z = Math.PI / 2;
  g.add(bone);
  g.add(mesh(sphere(0.007), '#fff8ec', 0.046, 0.005, 0));
  g.add(mesh(sphere(0.007), '#fff8ec', 0.046, -0.005, 0));
  g.scale.setScalar(scale);
  return g;
}

export function coin() {
  const m = mesh(cyl(0.014, 0.014, 0.005, 20), '#ffc233', 0, 0, 0, { metalness: 0.6, roughness: 0.3 });
  return m;
}

const cone = (r: number, h: number, seg = 10) => geo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));

/** 雪の積もったもみの木 */
export function pine(size: number) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.012, 0.016, 0.06), '#7a4e2e', 0, 0.03, 0));
  const tiers = [
    [0.1, 0.34, 0.07],
    [0.08, 0.26, 0.13],
    [0.055, 0.18, 0.19]
  ];
  for (const [r, h, y] of tiers) {
    g.add(mesh(cone(r, h * 0.45), '#2f8f5b', 0, y + h * 0.2, 0, { flatShading: true }));
    g.add(mesh(cone(r * 0.55, h * 0.2), '#ffffff', 0, y + h * 0.36, 0, { flatShading: true }));
  }
  g.scale.setScalar(size / 0.12);
  return g;
}

export function fire() {
  const g = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const log = mesh(cyl(0.012, 0.012, 0.09), '#7a4e2e', 0, 0.012, 0);
    log.rotation.set(Math.PI / 2, 0, a);
    g.add(log);
  }
  const flames: THREE.Mesh[] = [];
  for (const [r, h, color, dx] of [
    [0.03, 0.09, '#ff6a1f', 0],
    [0.02, 0.07, '#ffc233', 0.008],
    [0.014, 0.05, '#fff3a0', -0.004]
  ] as const) {
    const f = mesh(new THREE.ConeGeometry(r, h, 10), color, dx, 0.02 + h / 2, 0, {
      emissive: color,
      emissiveIntensity: 0.9
    });
    f.castShadow = false;
    flames.push(f);
    g.add(f);
  }
  return { group: g, flames };
}

const box = (w: number, h: number, d: number) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));

/** パッドの上に浮かべる目印 */
export function badge(id: 'bag' | 'power' | 'fire' | 'home') {
  const g = new THREE.Group();
  if (id === 'bag') {
    g.add(mesh(box(0.05, 0.05, 0.03), '#d9573f'));
    g.add(mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 14, Math.PI), '#8a2f1f', 0, 0.025, 0));
    g.add(mesh(box(0.03, 0.018, 0.005), '#ffc233', 0, -0.006, 0.016));
  } else if (id === 'power') {
    g.add(mesh(box(0.012, 0.07, 0.004), '#dfe4ee', 0, 0.02, 0, { metalness: 0.7, roughness: 0.25 }));
    g.add(mesh(box(0.04, 0.008, 0.01), '#ffc233', 0, -0.016, 0));
    g.add(mesh(cyl(0.005, 0.005, 0.025), '#7a4e2e', 0, -0.032, 0));
  } else if (id === 'fire') {
    const f = fire();
    f.group.scale.setScalar(0.7);
    f.group.position.y = -0.03;
    g.add(f.group);
  } else {
    g.add(mesh(box(0.08, 0.055, 0.07), '#fff4e2', 0, 0, 0));
    const roof = mesh(new THREE.ConeGeometry(0.07, 0.05, 4), '#ff4d5e', 0, 0.052, 0, { flatShading: true });
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(mesh(box(0.02, 0.03, 0.005), '#8a5a3b', 0, -0.012, 0.036));
  }
  return g;
}

/** 主人公の右手に持たせる斧。group の原点が握る位置で、+y が刃の側 */
export function axe() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.004, 0.005, 0.08), '#8a5a3b', 0, 0.035, 0));
  const head = mesh(box(0.006, 0.022, 0.03), '#c9ced9', 0, 0.068, 0.012, {
    metalness: 0.7,
    roughness: 0.3
  });
  g.add(head);
  g.add(mesh(box(0.007, 0.024, 0.005), '#eef1f6', 0, 0.068, 0.028, { metalness: 0.8, roughness: 0.2 }));
  return g;
}

/** 行き先の上で弾む目印（下向きの矢印と、足もとの輪） */
export function marker() {
  const g = new THREE.Group();
  const glow = { emissive: '#ffc233', emissiveIntensity: 0.6 };
  const arrow = mesh(new THREE.ConeGeometry(0.045, 0.075, 4), '#ffc233', 0, 0.2, 0, glow);
  arrow.rotation.x = Math.PI;
  arrow.castShadow = false;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 32),
    new THREE.MeshBasicMaterial({ color: '#ffc233', transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  g.add(arrow, ring);
  return { group: g, arrow, ring };
}

/** 主人公の足もとで行き先を指す矢印。-z の向きが前 */
export function pointer() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.13);
  shape.lineTo(0.045, -0.08);
  shape.lineTo(0.018, -0.08);
  shape.lineTo(0.018, -0.05);
  shape.lineTo(-0.018, -0.05);
  shape.lineTo(-0.018, -0.08);
  shape.lineTo(-0.045, -0.08);
  shape.closePath();
  const m = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: '#ffc233',
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false
    })
  );
  m.rotation.x = -Math.PI / 2;
  // 床や主人公の影に埋もれないよう、いつも手前に描く
  m.renderOrder = 10;
  const g = new THREE.Group();
  g.add(m);
  g.position.y = 0.03;
  return g;
}
