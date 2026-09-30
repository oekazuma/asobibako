import * as THREE from 'three';

/**
 * メガホンダッシュの 3D の部品。単位は m。x が横、y が高さ、走る向きは -z。
 * 人は頭の大きいデフォルメで、球・円柱・カプセル・箱だけで組む
 */

/** 走る子の後ろ上から見るカメラ。world3d と見本のシートが同じ数字を使う */
export const CAMERA = { fov: 55, back: 4.2, up: 2.7, look: 8, lookUp: 0.7 };
export const LANE_W = 1.7;
export const ROAD_W = LANE_W * 3 + 0.8;
export const SEG = 20;

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    materials.set(key, m);
  }
  return m;
}

const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。人と障害物は面全体で数百個になるので GPU に上げる回数を減らす */
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const sphere = (r: number) => geo(`s:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`c:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const capsule = (r: number, l: number) => geo(`p:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const box = (w: number, h: number, d: number) => geo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const torus = (r: number, t: number) => geo(`t:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));

function mesh(g: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** 腕と脚は付け根の Group を回して振る */
function joint(parent: THREE.Object3D, x: number, y: number, z = 0) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

export interface Figure {
  group: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  body: THREE.Mesh;
}

const SKIN = '#ffd9bd';

/** 頭の大きい 2 頭身の人。前は -z */
function chibi(o: { shirt: string; bottom: string; hair: string; skirt: boolean }): Figure {
  const group = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  for (const dx of [-0.1, 0.1]) {
    const hip = joint(group, dx, 0.46);
    hip.add(mesh(capsule(0.065, 0.24), SKIN, 0, -0.2));
    hip.add(mesh(cyl(0.07, 0.07, 0.12), '#ffffff', 0, -0.33));
    hip.add(mesh(box(0.13, 0.08, 0.2), '#5b3a29', 0, -0.42, -0.03));
    legs.push(hip);
  }
  group.add(mesh(o.skirt ? cyl(0.15, 0.3, 0.22) : cyl(0.17, 0.2, 0.2), o.bottom, 0, 0.52));
  const body = mesh(cyl(0.19, 0.21, 0.32), o.shirt, 0, 0.74);
  group.add(body);
  group.add(mesh(box(0.14, 0.07, 0.04), '#e0304a', 0, 0.86, -0.19));
  for (const side of [-1, 1]) {
    const shoulder = joint(group, side * 0.25, 0.86);
    shoulder.add(mesh(capsule(0.055, 0.2), o.shirt, 0, -0.14));
    shoulder.add(mesh(sphere(0.06), SKIN, 0, -0.3));
    arms.push(shoulder);
  }
  group.add(mesh(sphere(0.3), SKIN, 0, 1.18));
  const hair = mesh(sphere(0.32), o.hair, 0, 1.23, 0.05);
  hair.scale.set(1.02, 0.95, 1);
  group.add(hair);
  for (const dx of [-0.11, 0.11]) group.add(mesh(sphere(0.045), '#3a2230', dx, 1.15, -0.27));
  return { group, legs, arms, body };
}

/** 主人公。緑の髪のツインテール、緑のめがね、右手にメガホン */
export function runner(): Figure {
  const fig = chibi({ shirt: '#ffb6c9', bottom: '#34426b', hair: '#23433b', skirt: true });
  const g = fig.group;
  for (const side of [-1, 1]) {
    const tail = mesh(capsule(0.1, 0.5), '#23433b', side * 0.33, 0.95, 0.16);
    tail.rotation.z = side * 0.25;
    g.add(tail);
    g.add(mesh(sphere(0.06), '#ff4d5e', side * 0.3, 1.24, 0.1));
  }
  const tuft = mesh(torus(0.07, 0.02), '#23433b', 0, 1.58, 0);
  tuft.rotation.y = Math.PI / 2;
  g.add(tuft);
  for (const dx of [-0.11, 0.11]) {
    const lens = mesh(torus(0.075, 0.014), '#39c28a', dx, 1.15, -0.29);
    g.add(lens);
  }
  const hand = fig.arms[1];
  const horn = new THREE.Group();
  horn.position.set(0, -0.32, -0.08);
  horn.rotation.x = -Math.PI / 2;
  horn.add(mesh(cyl(0.15, 0.05, 0.3), '#f4f4f7', 0, 0.15));
  horn.add(mesh(torus(0.15, 0.025), '#ff3d8b', 0, 0.3).rotateX(Math.PI / 2));
  horn.add(mesh(box(0.06, 0.14, 0.08), '#ffc233', 0, -0.02, 0.05));
  hand.add(horn);
  return fig;
}

const SHIRTS = ['#ffffff', '#7fb8ff', '#ffd166', '#9be3a8', '#c7a6ff', '#ff9f80'];
const HAIRS = ['#3b2a20', '#1d1d24', '#8a5a2b', '#d9a441'];
const BOTTOMS = ['#34426b', '#3e3e46', '#6b5a48'];

/** 通行人。こちらへ歩いてくるので +z を向ける */
export function walker(seed: number): Figure {
  const fig = chibi({
    shirt: SHIRTS[seed % SHIRTS.length],
    bottom: BOTTOMS[seed % BOTTOMS.length],
    hair: HAIRS[(seed * 7) % HAIRS.length],
    skirt: seed % 3 === 0
  });
  fig.group.rotation.y = Math.PI;
  return fig;
}

/** ファンになった通行人は、光るピンクの服になって後ろを走る */
export function cheer(fig: Figure): void {
  const fan = mat('#ff7eb6', { emissive: '#ff3d8b', emissiveIntensity: 0.35 });
  fig.body.material = fan;
  // 袖は各腕の付け根の最初の子（chibi の組み立て順）
  for (const arm of fig.arms) (arm.children[0] as THREE.Mesh).material = fan;
  fig.group.rotation.y = 0;
}

/** 低いバリケード。黄と黒のしましまの板 2 枚 */
export function barricade(): THREE.Group {
  const g = new THREE.Group();
  const w = LANE_W * 0.86;
  const n = 6;
  for (const y of [0.22, 0.46])
    for (let i = 0; i < n; i++)
      g.add(mesh(box(w / n, 0.16, 0.06), i % 2 ? '#2b2d42' : '#ffc233', -w / 2 + (w / n) * (i + 0.5), y));
  for (const side of [-1, 1]) g.add(mesh(box(0.06, 0.56, 0.3), '#ffffff', side * (w / 2 - 0.05), 0.28));
  return g;
}

/** 高い柵。オレンジの工事の柵で、跳んでも越えられない高さ */
export function fence(): THREE.Group {
  const g = new THREE.Group();
  const w = LANE_W * 0.9;
  g.add(mesh(box(w, 1.3, 0.08), '#ff8a3d', 0, 0.95));
  for (const y of [0.6, 1.0, 1.4]) g.add(mesh(box(w, 0.1, 0.1), '#ffffff', 0, y));
  for (const side of [-1, 1]) {
    g.add(mesh(box(0.08, 1.7, 0.08), '#e0e0e0', side * (w / 2), 0.85));
    g.add(mesh(box(0.3, 0.1, 0.5), '#555a66', side * (w / 2), 0.05));
  }
  return g;
}

/** 道に立つ電柱。根もとに黄と黒の巻き */
export function pole(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.16, 0.2, 4), '#a3a8b0', 0, 2));
  for (let i = 0; i < 5; i++) g.add(mesh(cyl(0.21, 0.21, 0.2), i % 2 ? '#2b2d42' : '#ffc233', 0, 0.1 + i * 0.2));
  return g;
}

/** ボス。濃い青の丸い鬼で、赤い角と光る赤い目。こちら（+z）を向く */
export function boss(): { group: THREE.Group; eyes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const skin = '#3d5a80';
  const head = mesh(sphere(1.05), skin, 0, 0);
  head.scale.set(1.1, 0.95, 1);
  group.add(head);
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = mesh(
      sphere(0.2),
      mat('#ff2a3d', { emissive: '#ff2a3d', emissiveIntensity: 0.9 }),
      side * 0.38,
      0.15,
      0.9
    );
    eyes.push(eye);
    group.add(eye);
    const horn = mesh(cyl(0.03, 0.16, 0.9), '#d62839', side * 0.6, 0.95, 0);
    horn.rotation.z = -side * 0.5;
    group.add(horn);
    const arm = mesh(capsule(0.14, 0.9), skin, side * 0.95, -0.9, 0.3);
    arm.rotation.z = side * 0.3;
    group.add(arm);
  }
  group.add(mesh(box(0.9, 0.22, 0.2), '#1a1a24', 0, -0.4, 0.93));
  for (let i = 0; i < 4; i++)
    group.add(mesh(cyl(0, 0.07, 0.18, 8), '#ffffff', -0.3 + i * 0.2, -0.33, 1.0).rotateZ(Math.PI));
  return { group, eyes };
}

const WALLS = ['#e8e1d5', '#cfd8dc', '#b0bec5', '#f1e3c8', '#d7ccc8', '#c5cae9'];

/** 道ばたの家。side は道のどちら側か（-1 が左）で、窓を道の側に付ける */
function house(seed: number, side: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.5 + (seed % 4) * 1.2;
  g.add(mesh(box(4, h, 8), WALLS[seed % WALLS.length], 0, h / 2));
  g.add(mesh(box(4.2, 0.25, 8.2), '#6d6f7a', 0, h + 0.1));
  for (let row = 0; row < Math.floor(h / 1.6); row++)
    for (const z of [-2.2, 0, 2.2]) g.add(mesh(box(0.05, 0.8, 1.2), '#9fd3ff', -side * 2.01, 1.2 + row * 1.6, z));
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.16, 1.6), '#8a5a3c', 0, 0.8));
  g.add(mesh(sphere(0.9), '#5cbf6a', 0, 2.1));
  g.add(mesh(sphere(0.6), '#72d17f', 0.35, 2.6, 0.2));
  return g;
}

/** 車道・白い点線・歩道・点字ブロック・両側の家・木。原点から -z へ SEG m */
export function street(index: number): THREE.Group {
  const g = new THREE.Group();
  const road = new THREE.Mesh(box(ROAD_W, 0.1, SEG), mat('#8a9098'));
  road.position.set(0, -0.05, -SEG / 2);
  road.receiveShadow = true;
  g.add(road);
  for (const x of [-LANE_W / 2, LANE_W / 2])
    for (let z = 1; z < SEG; z += 4) {
      const dash = new THREE.Mesh(box(0.1, 0.02, 1.6), mat('#ffffff'));
      dash.position.set(x, 0.01, -z);
      g.add(dash);
    }
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(box(2.6, 0.2, SEG), mat('#cfc8bb'));
    walk.position.set(side * (ROAD_W / 2 + 1.3), 0.05, -SEG / 2);
    walk.receiveShadow = true;
    g.add(walk);
    const bumps = new THREE.Mesh(box(0.35, 0.21, SEG), mat('#f2c230'));
    bumps.position.set(side * (ROAD_W / 2 + 0.6), 0.05, -SEG / 2);
    g.add(bumps);
    for (const [k, z] of [5, 15].entries()) {
      const h = house(index * 4 + k * 2 + (side > 0 ? 1 : 0), side);
      h.position.set(side * (ROAD_W / 2 + 2.6 + 2.2), 0, -z);
      g.add(h);
    }
    const t = (index + (side > 0 ? 1 : 0)) % 2 ? tree() : pole();
    t.position.set(side * (ROAD_W / 2 + 2.2), 0.1, -10);
    g.add(t);
  }
  return g;
}

/** 校門。2 本の柱と「がっこう」の看板 */
export function gate(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  for (const side of [-1, 1]) group.add(mesh(box(0.6, 2.6, 0.6), '#b8bcc4', side * (ROAD_W / 2 + 0.3), 1.3));
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffc233';
  x.fillRect(0, 0, 1024, 160);
  x.fillStyle = '#2b2d42';
  x.font = "800 110px 'Hiragino Maru Gothic ProN', system-ui";
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('がっこう', 512, 84);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: texture });
  const sign = new THREE.Mesh(box(ROAD_W + 0.6, 1, 0.6), signMat);
  // 柱の上に載せる。看板が柱の中心から中心まで渡り、下の 5cm は柱にめり込ませる
  sign.position.set(0, 3.05, 0);
  group.add(sign);
  return {
    group,
    dispose: () => {
      texture.dispose();
      signMat.dispose();
    }
  };
}

/** メガホンから前へ飛ぶ音の輪。当たりは撃った瞬間に決まり、これは見た目だけ */
export function wave(): THREE.Mesh {
  return new THREE.Mesh(
    torus(0.35, 0.05),
    mat('#ff7eb6', { emissive: '#ff3d8b', emissiveIntensity: 0.9, transparent: true, opacity: 0.8 })
  );
}

/** ボスの投げたものが落ちる場所の赤い輪 */
export function warnRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    geo('ring', () => new THREE.RingGeometry(0.45, 0.65, 32)),
    mat('#ff2a3d', { emissive: '#ff2a3d', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}
