import * as THREE from 'three';
import type { Zone } from './course';
import { box, cyl, geo, mat, mesh, ROAD_W, SEG, sphere } from './models';
import {
  asphalt,
  classroomWall,
  concrete,
  facade,
  hallFloor,
  outsideWall,
  shopFront,
  sized,
  tactile,
  tiles
} from './textures';

/** 場所ごとの空（空の絵に掛ける色）・霧・光の色。景色が変わるたびに、ここへ向かって少しずつ寄せる */
export const MOOD: Record<Zone, { sky: string; fog: string; sun: string; sunI: number; hemi: string; ground: string }> =
  {
    street: { sky: '#ffffff', fog: '#cfe9ff', sun: '#fff1d6', sunI: 2.6, hemi: '#e6f4ff', ground: '#b7ae9f' },
    arcade: { sky: '#ffc08e', fog: '#ffd9b0', sun: '#ffd0a0', sunI: 2.0, hemi: '#ffe6c8', ground: '#a88d70' },
    hall: { sky: '#f2f7ff', fog: '#eef6fb', sun: '#ffffff', sunI: 1.4, hemi: '#f3f8ff', ground: '#9fb3b8' }
  };

/** 区間の番号は走り出す前の手前側で負になるので、表は 0 以上に直した番号で引く */
const pick = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length];

function glow(color: string, strength = 2.2) {
  return mat(color, { emissive: color, emissiveIntensity: strength });
}

const texMats = new Map<string, THREE.MeshStandardMaterial>();

/** 質感の絵を貼った材質。w × h（m）の面に、1 枚が tile（m）の大きさで並ぶ */
function tex(t: THREE.CanvasTexture, key: string, w: number, h: number, tileW: number, tileH = tileW, rough = 0.9) {
  const k = `${key}:${w}:${h}`;
  let m = texMats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: sized(t, key, w, h, tileW, tileH), roughness: rough });
    texMats.set(k, m);
  }
  return m;
}

/** 地面の板。中心 x、幅 w、奥行きは SEG。上面だけに絵を貼る */
function ground(x: number, w: number, y: number, m: THREE.Material, h = 0.1) {
  const g = new THREE.Mesh(box(w, h, SEG), m);
  g.position.set(x, y - h / 2, -SEG / 2);
  g.receiveShadow = true;
  return g;
}

/** 歩道の左の建物。正面（+x の面）に窓と看板の絵を貼る */
function building(n: number, side: number) {
  const seed = ((n % 6) + 6) % 6;
  const h = 12;
  const plain = mat(['#aeb3ba', '#c2bcb1', '#b8bfb4'][seed % 3]);
  const k = `facade:${seed % 6}`;
  let front = texMats.get(k);
  if (!front) {
    front = new THREE.MeshStandardMaterial({ map: facade(seed), roughness: 0.85 });
    texMats.set(k, front);
  }
  const faces = side < 0 ? [front, plain, plain, plain, plain, plain] : [plain, front, plain, plain, plain, plain];
  const b = new THREE.Mesh(box(6, h, 8), faces);
  b.position.y = h / 2;
  b.castShadow = b.receiveShadow = true;
  return b;
}

/** 葉のかたまりを重ねた街路樹。かたまりは面を平らに塗って、葉の重なりに見せる */
function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.14, 2.6), '#6d5140', 0, 1.3));
  const greens = ['#4f9a45', '#63b152', '#3f8a3c', '#78c060'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + seed;
    const r = i === 0 ? 0 : 0.7;
    const leaf = new THREE.Mesh(
      geo(`leaf:${i % 3}`, () => new THREE.IcosahedronGeometry(0.75 + (i % 3) * 0.15, 1)),
      mat(pick(greens, i + seed), { flatShading: true })
    );
    leaf.position.set(Math.cos(a) * r, 3.1 + (i % 2) * 0.5 + (i === 0 ? 0.6 : 0), Math.sin(a) * r);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/** 電柱。根もとに黄と黒のしましまのカバー、上に腕木 */
function pole(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.13, 0.17, 8), '#b3b1ab', 0, 4));
  for (let i = 0; i < 8; i++) {
    const band = mesh(cyl(0.2, 0.2, 0.22, 20), i % 2 ? '#26262c' : '#f2c21b', 0, 0.12 + i * 0.22);
    band.rotation.y = 0.4;
    g.add(band);
  }
  g.add(mesh(box(1.6, 0.1, 0.1), '#8a8f98', 0, 7.3));
  g.add(mesh(cyl(0.12, 0.12, 0.5), '#6f7580', 0.3, 6.6));
  return g;
}

/** 白いガードレール。支柱と 2 本の横板 */
function guardrail(): THREE.Group {
  const g = new THREE.Group();
  for (const y of [0.55, 0.85]) {
    const rail = new THREE.Mesh(box(0.06, 0.12, SEG), mat('#f4f4f2', { roughness: 0.4 }));
    rail.position.set(0, y, -SEG / 2);
    rail.castShadow = true;
    g.add(rail);
  }
  for (let z = 1; z < SEG; z += 2) g.add(mesh(cyl(0.04, 0.04, 0.9), '#e8e8e4', 0, 0.45, -z));
  return g;
}

/** 通学路。左に建物、真ん中が走る歩道（タイルと点字ブロック）、右にガードレールと車道、その先にまた建物 */
function street(index: number): THREE.Group {
  const g = new THREE.Group();
  const walkW = ROAD_W + 0.2;
  // 人は y = 0 に立つので、歩道の上面を 0 にし、車道はその縁石ぶん下げる
  g.add(ground(0, walkW, 0, tex(tiles(), 'tiles', walkW, SEG, 2)));
  const strip = new THREE.Mesh(box(0.32, 0.02, SEG), tex(tactile(), 'tactile', 0.32, SEG, 0.32, 0.3));
  strip.position.set(-1.1, 0.005, -SEG / 2);
  strip.receiveShadow = true;
  g.add(strip);
  const curb = new THREE.Mesh(box(0.25, 0.22, SEG), tex(concrete(), 'curb', 0.25, SEG, 1));
  curb.position.set(walkW / 2 + 0.12, -0.03, -SEG / 2);
  g.add(curb);
  g.add(ground(walkW / 2 + 4, 7.5, -0.12, tex(asphalt(), 'road', 7.5, SEG, 4)));
  for (const x of [walkW / 2 + 0.55, walkW / 2 + 7.4]) {
    const line = new THREE.Mesh(box(0.15, 0.02, SEG), mat('#f2f2ee'));
    line.position.set(x, -0.11, -SEG / 2);
    g.add(line);
  }
  for (let z = 2; z < SEG; z += 6) {
    const dash = new THREE.Mesh(box(0.15, 0.02, 3), mat('#f2f2ee'));
    dash.position.set(walkW / 2 + 4, -0.11, -z);
    g.add(dash);
  }
  const rail = guardrail();
  rail.position.x = walkW / 2 + 0.2;
  g.add(rail);
  g.add(ground(walkW / 2 + 9.3, 3, 0, tex(tiles(), 'tiles2', 3, SEG, 2)));
  for (const [k, z] of [4, 12].entries()) {
    const left = building(index * 2 + k, -1);
    left.position.set(-walkW / 2 - 3.2, 6, -z);
    g.add(left);
    const right = building(index * 2 + k + 3, 1);
    right.position.set(walkW / 2 + 13.8, 6, -z);
    g.add(right);
  }
  const p = pole();
  p.position.set(walkW / 2 + 0.35, 0, -6);
  g.add(p);
  const t = tree(index);
  t.position.set(walkW / 2 + 0.4, 0, -15);
  g.add(t);
  if (index % 2) {
    const t2 = tree(index + 3);
    t2.position.set(-walkW / 2 + 0.25, 0, -10);
    t2.scale.setScalar(0.85);
    g.add(t2);
  }
  // 電線。電柱の腕木から次の区間の電柱へ、少したるませて渡す
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const z = -6 - (i / 10) * SEG;
    pts.push(new THREE.Vector3(walkW / 2 + 0.35, 7.2 - Math.sin((i / 10) * Math.PI) * 0.5, z));
  }
  for (const dx of [-0.7, 0, 0.7]) {
    const wire = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts.map((v) => v.clone().setX(v.x + dx))),
      new THREE.LineBasicMaterial({ color: '#2d2f36' })
    );
    g.add(wire);
  }
  return g;
}

const SHOPS = ['#ff8f70', '#ffd166', '#7fd1ae', '#8fb8ff', '#d7a6ff', '#ff9ec8'];

/** 箱の 1 つの面にだけ絵を貼る材質の並び。face は +x, -x, +y, -y, +z, -z の順の番号 */
function faced(front: THREE.Material, plain: THREE.Material, face: number) {
  return [0, 1, 2, 3, 4, 5].map((i) => (i === face ? front : plain));
}

/** 商店街。店先の絵を貼った店・2 階の窓と看板・アーケードの屋根と梁・ちょうちん・吊り下がった旗 */
function arcade(index: number): THREE.Group {
  const g = new THREE.Group();
  const walkW = ROAD_W + 3;
  g.add(ground(0, walkW, 0, tex(tiles(), 'arcadeFloor', walkW, SEG, 2.4)));
  const tint = texMats.get('arcadeFloor:' + walkW + ':' + SEG)!;
  tint.color.set('#f1e2c8');
  for (const side of [-1, 1]) {
    for (const [k, z] of [5, 15].entries()) {
      const seed = index * 2 + k + (side > 0 ? 3 : 0);
      const key = `shopFront:${((seed % 6) + 6) % 6}`;
      let front = texMats.get(key);
      if (!front) {
        front = new THREE.MeshStandardMaterial({ map: shopFront(seed), roughness: 0.85 });
        texMats.set(key, front);
      }
      const shop = new THREE.Mesh(box(4, 4.6, 9.6), faced(front, mat('#e3d6c2'), side < 0 ? 0 : 1));
      shop.position.set(side * (walkW / 2 + 2), 2.3, -z);
      shop.castShadow = shop.receiveShadow = true;
      g.add(shop);
      // 2 階。窓の並びと、張り出した看板
      const upper = new THREE.Mesh(
        box(4, 2.6, 9.6),
        faced(tex(facade(seed + 1), 'upper' + (seed % 6), 9.6, 2.6, 8, 12), mat('#d9cdb8'), side < 0 ? 0 : 1)
      );
      upper.position.set(side * (walkW / 2 + 2), 5.9, -z);
      g.add(upper);
      const sign = mesh(box(0.12, 1.4, 0.5), glow(pick(SHOPS, seed), 0.5), side * (walkW / 2 - 0.2), 3.9, -z + 3);
      sign.castShadow = false;
      g.add(sign);
    }
    for (let z = 2; z < SEG; z += 4) {
      const lantern = mesh(sphere(0.26), glow(z % 8 === 2 ? '#ff5a4f' : '#ffb347'), side * (walkW / 2 - 0.6), 3.3, -z);
      lantern.scale.set(1, 1.3, 1);
      lantern.castShadow = false;
      g.add(lantern);
    }
  }
  // アーケードの屋根。梁の上に、光を通す半透明の板を並べる
  for (let z = 0; z < SEG; z += 4) {
    const beam = mesh(box(walkW + 1, 0.2, 0.2), '#7b7f8c', 0, 6.4, -z);
    beam.castShadow = false;
    g.add(beam);
    for (const side of [-1, 1]) {
      const post = mesh(box(0.2, 1.4, 0.2), '#7b7f8c', side * (walkW / 2), 5.8, -z);
      post.castShadow = false;
      g.add(post);
    }
  }
  const roof = new THREE.Mesh(
    box(walkW + 1, 0.05, SEG),
    mat('#fff4e0', { transparent: true, opacity: 0.3, emissive: '#fff1d0', emissiveIntensity: 0.4 })
  );
  roof.position.set(0, 6.6, -SEG / 2);
  g.add(roof);
  // 通りの上に吊った三角の旗の列
  for (let i = 0; i < 12; i++) {
    const flag = new THREE.Mesh(
      geo('flag', () => new THREE.ConeGeometry(0.18, 0.4, 3).rotateX(Math.PI)),
      mat(pick(SHOPS, i + index), { side: THREE.DoubleSide })
    );
    flag.position.set(-walkW / 2 + 0.5 + (i / 11) * (walkW - 1), 5.2 - Math.sin((i / 11) * Math.PI) * 0.5, -10);
    flag.castShadow = false;
    g.add(flag);
  }
  return g;
}

/** 校舎の廊下。緑灰色のタイルの床・教室の窓と腰板の壁・外の光が差す大きな窓の壁・天井の蛍光灯・柱 */
function hall(index: number): THREE.Group {
  const g = new THREE.Group();
  const half = 2.4;
  g.add(ground(0, half * 2, 0, tex(hallFloor(), 'hallFloor', half * 2, SEG, 2)));
  const plain = mat('#eceee8');
  const wall = (key: string, make: () => THREE.MeshStandardMaterial) => {
    let m = texMats.get(key);
    if (!m) {
      m = make();
      texMats.set(key, m);
    }
    return m;
  };
  const k = ((index % 3) + 3) % 3;
  const left = wall(
    `hallLeft:${k}`,
    () =>
      new THREE.MeshStandardMaterial({
        map: sized(classroomWall(k), `classroom${k}`, SEG, 3.4, 5, 3.4),
        roughness: 0.9
      })
  );
  // 外の光が差しこむ窓は、自分でも少し光らせて白くにじませる
  const right = wall('hallRight', () => {
    const t = sized(outsideWall(), 'outsideWall', SEG, 3.4, 5, 3.4);
    return new THREE.MeshStandardMaterial({
      map: t,
      emissive: '#ffffff',
      emissiveMap: t,
      emissiveIntensity: 0.35,
      roughness: 0.9
    });
  });
  const lw = new THREE.Mesh(box(0.2, 3.4, SEG), faced(left, plain, 0));
  lw.position.set(-half - 0.1, 1.7, -SEG / 2);
  lw.receiveShadow = true;
  g.add(lw);
  const rw = new THREE.Mesh(box(0.2, 3.4, SEG), faced(right, plain, 1));
  rw.position.set(half + 0.1, 1.7, -SEG / 2);
  rw.receiveShadow = true;
  g.add(rw);
  for (const side of [-1, 1])
    for (let z = 0; z < SEG; z += 5) {
      const pillar = mesh(box(0.3, 3.4, 0.4), '#f2f1ec', side * (half - 0.05), 1.7, -z);
      pillar.castShadow = false;
      g.add(pillar);
    }
  const ceiling = mesh(box(half * 2 + 0.4, 0.15, SEG), '#f4f4ef', 0, 3.45, -SEG / 2);
  ceiling.castShadow = false;
  g.add(ceiling);
  for (let z = 2.5; z < SEG; z += 5) {
    const light = mesh(box(0.35, 0.05, 1.6), glow('#ffffff', 2.6), 0, 3.37, -z);
    light.castShadow = false;
    g.add(light);
    const frame = mesh(box(0.45, 0.04, 1.7), '#d8d9d4', 0, 3.39, -z);
    frame.castShadow = false;
    g.add(frame);
  }
  return g;
}

export function segment(zone: Zone, index: number): THREE.Group {
  return zone === 'arcade' ? arcade(index) : zone === 'hall' ? hall(index) : street(index);
}
