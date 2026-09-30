import * as THREE from 'three';

/**
 * メガホンダッシュの 3D の部品。単位は m。x が横、y が高さ、走る向きは -z。
 * 人は頭の大きいデフォルメで、球・円柱・カプセル・箱だけで組む
 */

/** 走る子の後ろ上から見るカメラ。world3d と見本のシートが同じ数字を使う */
export const CAMERA = { fov: 55, back: 4.2, up: 2.7, look: 8, lookUp: 0.7 };
/** 車道の幅（m）。走る子が動けるのは engine の HALF まで */
export const ROAD_W = 5.9;
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
export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

export const sphere = (r: number) => geo(`s:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
export const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`c:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
export const box = (w: number, h: number, d: number) => geo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const torus = (r: number, t: number) => geo(`t:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));

export function mesh(g: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** メガホン。右手の骨に付けて、口を前（-z）へ向ける */
export function megaphone(): THREE.Group {
  const horn = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.x = -Math.PI / 2;
  body.add(mesh(cyl(0.12, 0.04, 0.26), '#f4f4f7', 0, 0.13));
  body.add(mesh(torus(0.12, 0.02), '#ff3d8b', 0, 0.26).rotateX(Math.PI / 2));
  body.add(mesh(box(0.05, 0.12, 0.07), '#ffc233', 0, -0.02, 0.04));
  horn.add(body);
  return horn;
}

/** ゴール。廊下の奥の、教室の入り口の柱と看板 */
export function gate(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const span = ROAD_W - 1.4;
  for (const side of [-1, 1]) group.add(mesh(box(0.6, 2.6, 0.6), '#b8bcc4', side * (span / 2 + 0.3), 1.3));
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
  x.fillText('きょうしつ', 512, 84);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: texture });
  const sign = new THREE.Mesh(box(span + 0.6, 1, 0.6), signMat);
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

/** 障害物。コーン（幅 w にならべる）・止めてある自転車・廊下の「そうじちゅう」の立て看板 */
export function obstacle(kind: 'cone' | 'bike' | 'board', w: number): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'cone') {
    const n = Math.max(2, Math.round(w / 0.45));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      g.add(mesh(cyl(0.04, 0.2, 0.62), '#ff7a1a', x, 0.33));
      g.add(mesh(cyl(0.11, 0.15, 0.1), '#ffffff', x, 0.36));
      g.add(mesh(box(0.42, 0.05, 0.42), '#3a3a44', x, 0.025));
    }
  } else if (kind === 'bike') {
    for (const z of [-0.5, 0.5]) {
      const wheel = mesh(torus(0.32, 0.035), '#2b2d42', 0, 0.34, z);
      wheel.rotation.y = Math.PI / 2;
      g.add(wheel);
    }
    const frame = mesh(box(0.06, 0.06, 0.95), '#e23b5a', 0, 0.55, 0);
    g.add(frame);
    g.add(mesh(box(0.06, 0.45, 0.06), '#e23b5a', 0, 0.55, -0.1));
    g.add(mesh(box(0.18, 0.05, 0.26), '#2b2d42', 0, 0.8, 0.15));
    g.add(mesh(box(0.55, 0.04, 0.04), '#c8ccd4', 0, 0.9, -0.45));
    g.add(mesh(box(0.35, 0.22, 0.3), '#8a5a3c', 0, 0.78, -0.62));
    g.rotation.y = Math.PI / 2;
  } else {
    for (const side of [-1, 1]) {
      const leg = mesh(box(0.7, 1.0, 0.04), '#ffd23a', 0, 0.48, side * 0.18);
      leg.rotation.x = side * 0.22;
      g.add(leg);
    }
    g.add(mesh(cyl(0.2, 0.16, 0.34), '#4d9bff', 0.55, 0.17, 0));
    g.add(mesh(cyl(0.2, 0.16, 0.34), '#4d9bff', -0.55, 0.17, 0));
  }
  return g;
}

/**
 * メガホンから前へ広がる音の扇。鳴るたびに 1 つ出して、広げながら消す。
 * 薄くしていく途中の透け具合が 1 つずつ違うので、材質は使い回さない
 */
export function soundCone(): THREE.Mesh {
  const g = geo('soundCone', () => {
    const c = new THREE.ConeGeometry(1, 1, 24, 1, true);
    // 先を原点（メガホンの口）に、開いた側を -z（前）へ向ける
    c.translate(0, -0.5, 0);
    c.rotateX(Math.PI / 2);
    return c;
  });
  const m = new THREE.MeshBasicMaterial({
    color: '#ff8ac4',
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(g, m);
}

/** ファンになった瞬間に飛ぶハート。絵は一度だけ描いて使い回す */
let heartTex: THREE.CanvasTexture | null = null;
export function heartTexture(): THREE.CanvasTexture {
  if (heartTex) return heartTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.translate(64, 70);
  x.beginPath();
  x.moveTo(0, 38);
  x.bezierCurveTo(-60, -4, -34, -58, 0, -26);
  x.bezierCurveTo(34, -58, 60, -4, 0, 38);
  x.fillStyle = '#ff4f9a';
  x.fill();
  x.lineWidth = 8;
  x.strokeStyle = '#ffffff';
  x.stroke();
  heartTex = new THREE.CanvasTexture(c);
  heartTex.colorSpace = THREE.SRGBColorSpace;
  return heartTex;
}
