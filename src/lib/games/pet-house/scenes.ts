import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PARK } from './layout';
import { cyl, geo, mat, mesh, sphere } from './props';
import { concrete, foliage, lawn, paint, seeded, siding } from './textures';

/**
 * 公園の背景と、部屋（scene-room.ts）とも使う部品。ライトは world3d が置く。
 * 床・壁・遠景は影を受けるだけにする（背の高い壁が影を落とすと、光の向きによっては床が真っ暗になる）
 */

/** mat() と geo() の分はモジュールで共有していて次に開いたときも使うので、それ以外の geometry・material・texture だけ捨てる */
export function release(group: THREE.Group) {
  const seen = new Set<THREE.Material | THREE.BufferGeometry>();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const r of [o.geometry, o.material] as (THREE.Material | THREE.BufferGeometry)[]) {
      if (r.userData.shared || seen.has(r)) continue;
      seen.add(r);
      if (r instanceof THREE.Material)
        for (const v of Object.values(r)) if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
      r.dispose();
    }
  });
}

export const rounded = (w: number, h: number, d: number, r: number) =>
  geo(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));

export function skyDome() {
  const map = paint(8, 256, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 256);
    s.addColorStop(0, '#6fa8d8');
    s.addColorStop(0.4, '#b4d3ea');
    s.addColorStop(0.5, '#e2edf2');
    s.addColorStop(1, '#e2edf2');
    g.fillStyle = s;
    g.fillRect(0, 0, 8, 256);
  });
  const m = new THREE.MeshBasicMaterial({
    map,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    toneMapped: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY, 24, 16), m);
  dome.renderOrder = -1;
  return dome;
}

/** 空の半径。world3d のカメラの far はこれより大きくする */
const SKY = 30;

/**
 * でこぼこの葉むら。球の頂点を方向ごとのこぶで押し出し、葉の明暗を頂点の色で散らす。
 * 頂点をつないでから動かす（面ごとに別の頂点のまま動かすと継ぎ目が割れて白い筋が出る）
 */
function clump(r: number, seed: number) {
  return geo(`clump:${r}:${seed}`, () => {
    const src = new THREE.IcosahedronGeometry(r, 4);
    src.deleteAttribute('uv');
    src.deleteAttribute('normal');
    const g = mergeVertices(src);
    src.dispose();
    const rnd = seeded(seed);
    const p = g.attributes.position;
    const bumps = Array.from({ length: 14 }, () =>
      new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()
    );
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const colors: number[] = [];
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      let k = 0;
      for (const b of bumps) k += Math.max(0, n.dot(b)) ** 8;
      const hash = Math.abs(Math.sin(n.x * 127.1 + n.y * 311.7 + n.z * 74.7) * 43758.5453) % 1;
      v.copy(n).multiplyScalar(r * (0.82 + Math.min(k, 1) * 0.28 + hash * 0.05));
      // 下側は少し平らにつぶすと、枝の下から見上げたときの葉の天井に見える
      if (v.y < 0) v.y *= 0.7;
      p.setXYZ(i, v.x, v.y, v.z);
      // 上とこぶの先は日が当たって明るく、くぼみと下は暗い
      const lit = 0.62 + 0.2 * n.y + 0.25 * Math.min(k, 1) + (hash - 0.5) * 0.3;
      colors.push(lit, lit, lit);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  });
}

export function tree(scale: number, leaf: THREE.Material, shadow = true) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.08, 0.13, 1.3, 10), mat('#5e4633', { roughness: 0.95 }), 0, 0.65, 0, shadow));
  for (const [x, y, z, r, s] of [
    [0, 1.7, 0, 0.7, 1],
    [-0.42, 1.4, 0.12, 0.45, 2],
    [0.4, 1.45, -0.08, 0.5, 3],
    [0.05, 2.15, 0.05, 0.45, 4]
  ])
    g.add(mesh(clump(r, s), leaf, x, y, z, shadow));
  g.scale.setScalar(scale);
  return g;
}

export function bush(leaf: THREE.Material) {
  const g = new THREE.Group();
  for (const [x, z, r, s] of [
    [0, 0, 0.3, 5],
    [-0.2, 0.08, 0.22, 6],
    [0.19, 0.06, 0.24, 7]
  ])
    g.add(mesh(clump(r, s), leaf, x, r * 0.75, z));
  const flowers = ['#e8739c', '#f1c94a', '#f4f1ea'];
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    g.add(
      mesh(
        sphere(0.016, 8, 6),
        flowers[i % 3],
        Math.cos(a) * 0.26,
        0.18 + (i % 4) * 0.08,
        Math.sin(a) * 0.2 + 0.1,
        false
      )
    );
  }
  return g;
}

export function bench() {
  const g = new THREE.Group();
  const wood = mat('#9a6a42', { roughness: 0.7 });
  const iron = mat('#2c2f36', { roughness: 0.45, metalness: 0.6 });
  for (const z of [-0.08, 0.02, 0.12]) g.add(mesh(rounded(1.3, 0.035, 0.085, 0.01), wood, 0, 0.42, z));
  for (const y of [0.58, 0.7]) g.add(mesh(rounded(1.3, 0.08, 0.03, 0.01), wood, 0, y, -0.17));
  for (const s of [-1, 1]) {
    g.add(mesh(rounded(0.04, 0.42, 0.34, 0.01), iron, s * 0.55, 0.21, 0));
    g.add(mesh(rounded(0.04, 0.35, 0.035, 0.01), iron, s * 0.55, 0.6, -0.17));
  }
  return g;
}

/** 三角屋根の家。遠景なので影は落とさない */
export function house(wall: THREE.Material, roof: string, w: number, h: number) {
  const g = new THREE.Group();
  const d = 3;
  g.add(
    mesh(
      geo(`house:${w}:${h}`, () => new THREE.BoxGeometry(w, h, d)),
      wall,
      0,
      h / 2,
      0,
      false
    )
  );
  const gable = geo(`gable:${w}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.25, 0);
    s.lineTo(w / 2 + 0.25, 0);
    s.lineTo(0, w * 0.42);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: d + 0.3, bevelEnabled: false }).translate(0, 0, -(d + 0.3) / 2);
  });
  g.add(mesh(gable, mat(roof, { roughness: 0.9 }), 0, h, 0, false));
  g.add(
    mesh(
      geo('chimney', () => new THREE.BoxGeometry(0.4, 1, 0.4)),
      '#8a4b3a',
      w * 0.25,
      h + w * 0.3,
      -0.6,
      false
    )
  );
  const frame = mat('#f7f4ee');
  const glass = mat('#3d4a58', { roughness: 0.15, metalness: 0.3 });
  for (const x of [-w * 0.28, w * 0.28])
    for (const y of [h * 0.3, h * 0.72]) {
      g.add(
        mesh(
          geo('win-frame', () => new THREE.BoxGeometry(0.62, 0.78, 0.05)),
          frame,
          x,
          y,
          d / 2 + 0.01,
          false
        )
      );
      g.add(
        mesh(
          geo('win-glass', () => new THREE.BoxGeometry(0.48, 0.64, 0.05)),
          glass,
          x,
          y,
          d / 2 + 0.03,
          false
        )
      );
    }
  g.add(
    mesh(
      geo('door', () => new THREE.BoxGeometry(0.55, 1.05, 0.05)),
      roof,
      0,
      0.53,
      d / 2 + 0.02,
      false
    )
  );
  return g;
}

/**
 * ペットのまわりの芝の葉。地面の絵だけでは平らに見えるので、細い三角を立てて足元をうずめる。
 * 1 つの InstancedMesh なので描画は 1 回で、影は落とさない。
 * 表と裏の三角を別に持ち、どちらも法線を上へ向ける（DoubleSide は裏で法線を裏返し、葉が黒く見える）
 */
let grassBlades: THREE.InstancedMesh | null = null;

/** 6 万本の配置は毎回同じなので、1 度作ったものを公園を開くたびに使い回す */
export function blades() {
  grassBlades ??= makeBlades();
  return grassBlades;
}

function makeBlades() {
  const blade = new THREE.BufferGeometry();
  const tri = [-0.003, 0, 0, 0.003, 0, 0, 0, 1, 0];
  blade.setAttribute('position', new THREE.Float32BufferAttribute([...tri, ...tri], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [0, 1, 0]).flat(), 3));
  blade.setIndex([0, 1, 2, 4, 3, 5]);
  const n = 60000;
  const m = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const rnd = seeded(37);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const { x0, x1, z0, z1 } = PARK.bounds;
  for (let i = 0; i < n; i++) {
    o.position.set(x0 - 0.8 + rnd() * (x1 - x0 + 1.6), 0, z0 + rnd() * (z1 - z0 + 1.2));
    o.rotation.set((rnd() - 0.5) * 0.6, rnd() * Math.PI, (rnd() - 0.5) * 0.6);
    const h = 0.025 + rnd() * 0.04;
    o.scale.set(1 + rnd(), h, 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, c.setHSL(0.24 + rnd() * 0.05, 0.5 + rnd() * 0.15, 0.15 + rnd() * 0.1));
  }
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.geometry.userData.shared = true;
  (m.material as THREE.Material).userData.shared = true;
  return m;
}

export function buildPark(): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();

  const grassMap = lawn();
  grassMap.repeat.set(60 / 3, 60 / 3);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -10;
  ground.receiveShadow = true;

  const walk = concrete();
  walk.repeat.set(40, 1);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.03, 1.4),
    new THREE.MeshStandardMaterial({ map: walk, roughness: 0.95 })
  );
  path.position.set(0, 0.015, -7.6);
  path.receiveShadow = true;
  group.add(ground, path, blades(), skyDome());

  const leaf = (color: string) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9 });
  const green = leaf('#628c42');
  const deep = leaf('#4f7a36');
  const blossom = leaf('#c79aad');

  const [a, b, c, d] = PARK.blocks;
  for (const [spot, s, l] of [
    [a, 0.9, green],
    [b, 1, deep],
    [d, 0.85, green]
  ] as const) {
    const t = tree(s, l);
    t.position.set(spot.x, 0, spot.z);
    t.rotation.y = spot.x * 3;
    group.add(t);
  }
  const shrub = bush(deep);
  shrub.position.set(c.x, 0, c.z);
  group.add(shrub);

  for (const x of [-0.7, 3.2]) {
    const seat = bench();
    seat.position.set(x, 0.03, -7.2);
    group.add(seat);
  }

  const hedgeMap = foliage(41);
  hedgeMap.repeat.set(60, 1);
  const hedge = mesh(
    rounded(40, 0.7, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: '#4a7433', map: hedgeMap, roughness: 0.95 }),
    0,
    0.35,
    -9.2,
    false
  );
  group.add(hedge);

  const board = siding();
  board.repeat.set(4, 4);
  const walls = ['#f1ece2', '#c9d7e2', '#e8e0cf', '#b7584a', '#dfe6ea', '#9fb3c4'].map(
    (color) => new THREE.MeshStandardMaterial({ color, map: board, roughness: 0.9 })
  );
  const roofs = ['#3d4450', '#6b4b3e', '#4a5363'];
  for (let i = 0; i < 9; i++) {
    const h = house(walls[i % walls.length], roofs[i % roofs.length], 3 + (i % 3) * 0.6, 2.8 + (i % 2) * 0.8);
    h.position.set(-19 + i * 4.8, 0, -21 - (i % 2) * 1.5);
    group.add(h);
  }
  for (let i = 0; i < 12; i++) {
    const t = tree(1.4 + (i % 3) * 0.3, i % 5 === 1 ? blossom : i % 2 ? green : deep, false);
    t.position.set(-19 + i * 3.4 + (i % 2), 0, -14 - (i % 3) * 1.5);
    group.add(t);
  }

  return { group, dispose: () => release(group) };
}
