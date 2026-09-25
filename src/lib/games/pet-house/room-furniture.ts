import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RoomTheme } from './decor';
import { box, cyl, geo, mat, mesh, sphere, torus } from './props';
import { dots, lace, patternRug, shag, shojiPaper } from './room-textures';
import { rounded } from './scenes';
import { lampGlass, lampPool, pool } from './sky3d';
import { paint, rug as kilim, seeded } from './textures';

/** 部屋の家具のテーマ違い。置き場所と大きさ（ペットの当たり）はテーマで変えない */

/** 布の張り地。sheen で縁が明るく抜け、ビニールのようなつやが出ない */
export function cloth(color: string, map: THREE.Texture, repeat: number, sheen = 0.7) {
  const m = map.clone();
  m.repeat.set(repeat, repeat);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: m,
    roughness: 0.9,
    sheen,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45)
  });
}

const gold = () => mat('#d8a94a', { metalness: 0.85, roughness: 0.3 });

/** ハートの形。幅 w、ふくらみが +y、とがりが -y で、中心を原点に寄せる */
function heartShape(w: number) {
  const s = w / 2;
  const h = new THREE.Shape();
  h.moveTo(0, 0.55 * s);
  h.bezierCurveTo(0, 1.1 * s, -s, 1.1 * s, -s, 0.55 * s);
  h.bezierCurveTo(-s, 0.05 * s, -0.2 * s, -0.25 * s, 0, -0.65 * s);
  h.bezierCurveTo(0.2 * s, -0.25 * s, s, 0.05 * s, s, 0.55 * s);
  h.bezierCurveTo(s, 1.1 * s, 0, 1.1 * s, 0, 0.55 * s);
  return h;
}

/** ふっくらしたハートのクッション。原点は形の中心 */
function heartPillow(w: number, material: THREE.Material) {
  return mesh(
    geo(`heart-pillow:${w}`, () =>
      new THREE.ExtrudeGeometry(heartShape(w), {
        depth: w * 0.12,
        bevelThickness: w * 0.14,
        bevelSize: w * 0.1,
        bevelSegments: 5,
        curveSegments: 20
      }).center()
    ),
    material
  );
}

/** リボンの蝶結び。s は片方の輪の長さ。原点は結び目で、+z が正面 */
export function bow(material: THREE.Material, s: number) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const loop = mesh(sphere(1, 16, 10), material, side * s * 0.75, s * 0.1, 0);
    loop.scale.set(s * 0.8, s * 0.5, s * 0.28);
    loop.rotation.z = side * 0.35;
    g.add(loop);
    const tail = mesh(box(s * 0.32, s * 0.9, s * 0.06), material, side * s * 0.3, -s * 0.5, -s * 0.05);
    tail.rotation.z = side * 0.4;
    g.add(tail);
  }
  const knot = mesh(sphere(1, 12, 8), material, 0, 0, s * 0.05);
  knot.scale.set(s * 0.3, s * 0.32, s * 0.22);
  g.add(knot);
  return g;
}

interface SofaStyle {
  fabric: THREE.Material;
  legs: THREE.Material;
  /** 丸い玉の脚（おしろ）か、細い斜めの脚か */
  ball?: boolean;
  /** 背もたれを高くして、上に金の縁を付ける */
  crest?: boolean;
  /** 背のクッションにボタンを埋めたふかふかの張り */
  tufts?: THREE.Material;
}

/** 奥の壁ぎわの 2 人がけ。幅 1.5m、奥行き 0.78m */
function couch(style: SofaStyle) {
  const g = new THREE.Group();
  const f = style.fabric;
  const w = 1.5;
  const d = 0.78;
  g.add(mesh(rounded(w, 0.2, d, 0.04), f, 0, 0.26, 0));
  g.add(mesh(rounded(w, style.crest ? 0.72 : 0.46, 0.16, 0.05), f, 0, style.crest ? 0.67 : 0.54, -d / 2 + 0.08));
  for (const s of [-1, 1]) {
    g.add(mesh(rounded(0.15, 0.3, d, 0.06), f, s * (w / 2 - 0.075), 0.46, 0));
    g.add(mesh(rounded(0.61, 0.13, d - 0.2, 0.05), f, s * 0.31, 0.42, 0.07));
    const back = mesh(rounded(0.6, 0.36, 0.14, 0.06), f, s * 0.31, 0.64, -d / 2 + 0.22);
    back.rotation.x = -0.14;
    g.add(back);
    if (style.tufts)
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 2; j++)
          g.add(
            mesh(
              sphere(0.014, 8, 6),
              style.tufts,
              s * 0.31 + (i - 1) * 0.18,
              0.58 + j * 0.13,
              -d / 2 + 0.3 - j * 0.02,
              false
            )
          );
  }
  if (style.crest) {
    const rail = mesh(cyl(0.018, 0.018, w + 0.04, 12), gold(), 0, 1.03, -d / 2 + 0.08);
    rail.rotation.z = Math.PI / 2;
    g.add(rail);
    for (const s of [-1, 1]) g.add(mesh(sphere(0.035, 14, 10), gold(), s * (w / 2 + 0.02), 1.03, -d / 2 + 0.08));
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      if (style.ball) {
        g.add(mesh(sphere(0.06, 14, 10), style.legs, sx * (w / 2 - 0.1), 0.08, sz * (d / 2 - 0.08)));
        continue;
      }
      const leg = mesh(cyl(0.022, 0.012, 0.17, 10), style.legs, sx * (w / 2 - 0.1), 0.085, sz * (d / 2 - 0.08));
      leg.rotation.set(sz * 0.18, 0, -sx * 0.18);
      g.add(leg);
    }
  return g;
}

function pillow(g: THREE.Group, material: THREE.Material, x: number, tilt: number) {
  const p = mesh(rounded(0.38, 0.36, 0.11, 0.05), material, x, 0.67, -0.12);
  p.rotation.set(-0.28, 0, tilt);
  g.add(p);
  return p;
}

export function sofa(theme: RoomTheme, weave: THREE.Texture) {
  if (theme === 'wafu') return lowSofa(weave);
  if (theme === 'pink') {
    const g = couch({ fabric: cloth('#f4a6c0', weave, 3, 1), legs: gold() });
    const heart = heartPillow(0.36, cloth('#ee6f9a', weave, 1.5, 1));
    heart.position.set(-0.46, 0.7, -0.1);
    heart.rotation.set(-0.3, 0, 0.12);
    g.add(heart);
    // 白いクッションにピンクのリボンを十字にかけ、正面で蝶結びにする
    const ribbon = cloth('#e45a8b', weave, 1, 1);
    const gift = pillow(g, cloth('#fff4f7', weave, 1.5), -0.06, -0.06);
    gift.add(mesh(box(0.07, 0.37, 0.115), ribbon, 0, 0, 0, false));
    gift.add(mesh(box(0.39, 0.07, 0.115), ribbon, 0, 0, 0, false));
    const knot = bow(ribbon, 0.07);
    knot.position.set(0, 0, 0.07);
    gift.add(knot);
    pillow(g, cloth('#ffffff', dots('#f9c4d6', '#ffffff'), 2), 0.5, -0.05);
    return g;
  }
  if (theme === 'nordic') {
    const g = couch({ fabric: cloth('#cfcac1', weave, 5, 0.4), legs: mat('#c79f72', { roughness: 0.55 }) });
    pillow(g, cloth('#d3a24a', weave, 1.5), -0.46, 0.1);
    pillow(g, cloth('#8ea4b3', weave, 1.5), -0.14, -0.08);
    pillow(g, cloth('#ffffff', dots('#f1ede6', '#3a3836'), 3), 0.5, -0.05);
    // 右のひじかけに掛けたニットのひざかけ
    const knit = cloth('#e7dfd0', weave, 6, 0.9);
    g.add(mesh(rounded(0.2, 0.03, 0.5, 0.012), knit, 0.68, 0.62, 0.05));
    g.add(mesh(rounded(0.03, 0.34, 0.5, 0.012), knit, 0.77, 0.45, 0.05));
    return g;
  }
  if (theme === 'castle') {
    const velvet = cloth('#8a1a2c', weave, 3, 1);
    const g = couch({
      fabric: velvet,
      legs: gold(),
      ball: true,
      crest: true,
      tufts: mat('#5c0f1c', { roughness: 0.6 })
    });
    for (const [x, tilt] of [
      [-0.46, 0.1],
      [0.5, -0.05]
    ]) {
      const p = pillow(g, cloth('#d9b25e', weave, 1.5, 1), x, tilt);
      for (const cx of [-1, 1])
        for (const cy of [-1, 1]) p.add(mesh(sphere(0.02, 8, 6), gold(), cx * 0.19, cy * 0.18, 0, false));
    }
    return g;
  }
  const g = couch({ fabric: cloth('#7f9d72', weave, 3), legs: mat('#5a3a24', { roughness: 0.5 }) });
  pillow(g, cloth('#c98a36', weave, 1.5), -0.46, 0.1);
  pillow(g, cloth('#a8453a', weave, 1.5), -0.14, -0.08);
  pillow(g, cloth('#e4dccb', weave, 1.5), 0.5, -0.05);
  return g;
}

/** わしつの低いソファ。黒っぽい木の枠に藍の座布団をのせる */
function lowSofa(weave: THREE.Texture) {
  const g = new THREE.Group();
  const wood = mat('#4a2e1c', { roughness: 0.45 });
  const ai = cloth('#2c3e6b', weave, 3);
  const kinari = cloth('#e8dcc2', weave, 2);
  g.add(mesh(rounded(1.5, 0.14, 0.78, 0.02), wood, 0, 0.11, 0));
  for (const s of [-1, 1]) g.add(mesh(rounded(0.08, 0.28, 0.78, 0.02), wood, s * 0.71, 0.3, 0));
  g.add(mesh(rounded(1.5, 0.36, 0.06, 0.02), wood, 0, 0.36, -0.36));
  g.add(mesh(rounded(1.32, 0.1, 0.66, 0.05), ai, 0, 0.23, 0.04));
  for (const s of [-1, 1]) {
    const back = mesh(rounded(0.62, 0.38, 0.14, 0.06), s < 0 ? kinari : ai, s * 0.32, 0.46, -0.25);
    back.rotation.x = -0.15;
    g.add(back);
  }
  const zabuton = mesh(rounded(0.4, 0.07, 0.4, 0.03), cloth('#8a2f3a', weave, 1.5), 0.3, 0.31, 0.08);
  zabuton.rotation.y = 0.2;
  g.add(zabuton);
  for (const s of [-1, 1])
    for (const t of [-1, 1]) g.add(mesh(cyl(0.03, 0.03, 0.04, 8), wood, s * 0.68, 0.02, t * 0.33));
  return g;
}

/** 観葉植物の植わった籐のかご。葉は 1 つの形にまとめて、1 回の描画で済ませる */
export function plant() {
  const g = new THREE.Group();
  const basket = paint(
    128,
    64,
    (c) => {
      c.fillStyle = '#c9ab78';
      c.fillRect(0, 0, 128, 64);
      for (let y = 0; y < 64; y += 4)
        for (let x = 0; x < 128; x += 8) {
          c.fillStyle = (x / 8 + y / 4) % 2 ? 'rgb(90 60 25 / 0.35)' : 'rgb(255 240 200 / 0.2)';
          c.fillRect(x, y, 8, 3);
        }
    },
    true
  );
  basket.repeat.set(3, 3);
  g.add(mesh(cyl(0.19, 0.15, 0.36, 24), new THREE.MeshStandardMaterial({ map: basket, roughness: 0.95 }), 0, 0.18, 0));
  // かごの円柱は上にふたがあるので、土をふたと同じ高さに置くと模様と土がちらつく。土の面を少し上に出す
  g.add(mesh(cyl(0.182, 0.182, 0.02, 20), '#3b2a1c', 0, 0.363, 0, false));
  g.add(mesh(cyl(0.012, 0.02, 1.1, 6), '#5d4630', 0, 0.9, 0));

  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.bezierCurveTo(0.05, 0.05, 0.05, 0.16, 0, 0.22);
  leaf.bezierCurveTo(-0.05, 0.16, -0.05, 0.05, 0, 0);
  const base = new THREE.ShapeGeometry(leaf, 6);
  const rnd = seeded(29);
  const parts: THREE.BufferGeometry[] = [];
  const colors: number[] = [];
  const tones = [new THREE.Color('#4c7a3e'), new THREE.Color('#5f8c48'), new THREE.Color('#3d6a34')];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39;
    const h = 0.7 + rnd() * 0.85;
    q.setFromEuler(new THREE.Euler(-0.6 - rnd() * 0.6, -a, (rnd() - 0.5) * 0.4, 'YXZ'));
    const s = 0.8 + rnd() * 0.6;
    m.compose(new THREE.Vector3(Math.cos(a) * 0.04, h, Math.sin(a) * 0.04), q, new THREE.Vector3(s, s, s));
    const p = base.clone().applyMatrix4(m);
    const tone = tones[i % 3];
    for (let k = 0; k < p.attributes.position.count; k++) colors.push(tone.r, tone.g, tone.b);
    parts.push(p);
  }
  const leaves = mergeGeometries(parts)!;
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.add(
    mesh(
      leaves,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
      0,
      0,
      0
    )
  );
  base.dispose();
  for (const p of parts) p.dispose();
  return g;
}

/**
 * ソファの右の、あたたかい電球色のフロアランプ。夜はかさが光り、うしろの壁と床にぼんやり明るい丸が出る
 * （光源を足すと毛の殻まで全部の材質を描き直すので、明るさは絵で見せる）
 */
export function floorLamp() {
  const g = new THREE.Group();
  const brass = mat('#b89160', { metalness: 0.6, roughness: 0.4 });
  g.add(mesh(cyl(0.13, 0.15, 0.03, 24), brass, 0, 0.015, 0));
  g.add(mesh(cyl(0.012, 0.012, 1.28, 8), brass, 0, 0.66, 0));
  const shade = geo('lamp-shade', () => new THREE.CylinderGeometry(0.12, 0.2, 0.26, 24, 1, true));
  g.add(mesh(shade, lampGlass, 0, 1.42, 0, false));
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), lampPool);
  wall.position.set(0, 1.35, -0.15);
  g.add(wall, pool(0, 0.1, 0.7));
  return g;
}

/** ペットのベッド。寝る面はどのテーマも 0.1m より低くして、寝たペットが沈んだり浮いたりしないようにする */
export function petBed(theme: RoomTheme, weave: THREE.Texture) {
  const g = new THREE.Group();
  if (theme === 'wafu') {
    const cushion = mesh(rounded(0.64, 0.09, 0.64, 0.04), cloth('#8a2f3a', weave, 3), 0, 0.045, 0);
    cushion.rotation.y = 0.15;
    g.add(cushion);
    const tassel = mat('#e0b95a', { roughness: 0.8 });
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      const t = mesh(cyl(0.004, 0.018, 0.05, 8), tassel, 0, 0.06, 0, false);
      t.position.set(x * 0.3, 0.07, z * 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15);
      t.rotation.z = x * 0.8;
      g.add(t);
    }
    return g;
  }
  if (theme === 'nordic') {
    const felt = cloth('#8f8e8a', weave, 5, 0.3);
    const wall = geo(
      'felt-basket',
      () =>
        new THREE.LatheGeometry(
          [
            [0.3, 0],
            [0.32, 0.02],
            [0.34, 0.16],
            [0.31, 0.17],
            [0.29, 0.03]
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          40
        )
    );
    g.add(mesh(wall, felt, 0, 0, 0));
    g.add(mesh(cyl(0.3, 0.3, 0.07, 36), cloth('#e6dccb', weave, 4), 0, 0.035, 0));
    return g;
  }
  const rimColor = { natural: '#c77b62', pink: '#f59ab8', castle: '#8a1a2c' }[theme];
  const rim = mesh(
    geo('bed-rim', () => new THREE.TorusGeometry(0.28, 0.1, 16, 40)),
    cloth(rimColor, weave, 4, theme === 'natural' ? 0.7 : 1),
    0,
    0.1,
    0
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 1.1;
  g.add(rim);
  const inner = { natural: '#e8cfc0', pink: '#fff0f5', castle: '#d9b25e' }[theme];
  g.add(mesh(cyl(0.3, 0.3, 0.08, 36), cloth(inner, weave, 4), 0, 0.05, 0));
  if (theme === 'pink') {
    const knot = bow(cloth('#e45a8b', weave, 1, 1), 0.07);
    knot.position.set(0, 0.2, 0.37);
    g.add(knot);
  }
  if (theme === 'castle') {
    const piping = mesh(torus(0.3, 0.012, 8, 48), gold(), 0, 0.21, 0, false);
    piping.rotation.x = Math.PI / 2;
    piping.scale.y = 1.1;
    g.add(piping);
    const crown = castleCrown();
    crown.position.set(0.28, 0.2, -0.26);
    crown.rotation.set(-0.2, 0.5, 0.15);
    g.add(crown);
  }
  return g;
}

/** おしろのベッドのふちに飾る小さな王冠 */
function castleCrown() {
  const g = new THREE.Group();
  const metal = gold();
  const band = geo('crown-band', () => new THREE.CylinderGeometry(0.05, 0.045, 0.035, 20, 1, true));
  g.add(
    mesh(
      band,
      new THREE.MeshStandardMaterial({ color: '#d8a94a', metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }),
      0,
      0.018,
      0
    )
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = mesh(
      geo('crown-spike', () => new THREE.ConeGeometry(0.012, 0.04, 6)),
      metal,
      0,
      0.055,
      0
    );
    spike.position.set(Math.cos(a) * 0.048, 0.055, Math.sin(a) * 0.048);
    g.add(spike);
    g.add(mesh(sphere(0.007, 8, 6), metal, Math.cos(a) * 0.048, 0.078, Math.sin(a) * 0.048, false));
  }
  g.add(mesh(sphere(0.01, 10, 8), mat('#3a6fd8', { roughness: 0.1, metalness: 0.2 }), 0, 0.018, 0.05, false));
  return g;
}

/** ラグの両端の房。細い棒を 1 つの形にまとめる */
function fringe(width: number) {
  return geo(`fringe:${width}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    const rnd = seeded(31);
    for (let x = -width / 2 + 0.01; x < width / 2; x += 0.018) {
      const l = 0.05 + rnd() * 0.015;
      const b = new THREE.BoxGeometry(0.006, 0.003, l).translate(x, 0.004, l / 2);
      b.rotateY((rnd() - 0.5) * 0.12);
      parts.push(b);
    }
    const merged = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    return merged;
  });
}

/**
 * 床のラグ。上の面は高さ 0.008m にそろえる（足元の影 blob を 0.009m に置いていて、それより厚いと影が隠れる）。
 * 原点はラグの中心
 */
export function rugOf(theme: RoomTheme) {
  const g = new THREE.Group();
  if (theme === 'pink') {
    const map = shag().clone();
    map.repeat.set(2, 2);
    const fluffy = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map,
      roughness: 1,
      sheen: 1,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#ffe6ef')
    });
    const heart = new THREE.ExtrudeGeometry(heartShape(2.1), {
      depth: 0.002,
      bevelThickness: 0.003,
      bevelSize: 0.03,
      bevelSegments: 3,
      curveSegments: 32
    });
    const top = new THREE.Mesh(heart, fluffy);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.003;
    top.receiveShadow = true;
    const rim = new THREE.Mesh(
      new THREE.ShapeGeometry(heartShape(2.26), 32),
      new THREE.MeshPhysicalMaterial({
        color: '#fffafc',
        roughness: 1,
        sheen: 1,
        sheenColor: new THREE.Color('#ffffff')
      })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, 0.002, 0.02);
    rim.receiveShadow = true;
    g.add(rim, top);
    return g;
  }
  const size = { natural: [1.8, 2.4], wafu: [1.6, 2.2], nordic: [1.7, 2.3], castle: [1.8, 2.4] }[theme];
  const map = theme === 'natural' ? kilim() : patternRug(theme);
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], 0.008, size[1]),
    new THREE.MeshStandardMaterial({ map, roughness: 1 })
  );
  carpet.position.y = 0.004;
  carpet.receiveShadow = true;
  g.add(carpet);
  const tassel = { natural: '#e9dcc0', nordic: '#efe8da', castle: '#d8ac52', wafu: null }[theme];
  if (tassel)
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(fringe(size[0]), mat(tassel, { roughness: theme === 'castle' ? 0.5 : 1 }));
      f.position.z = (s * size[1]) / 2;
      f.rotation.y = s > 0 ? 0 : Math.PI;
      f.receiveShadow = true;
      g.add(f);
    }
  return g;
}

/**
 * 布のひだ。縦に波打たせ、gather を渡すとその高さで外側（side の向き）へしぼる。
 * 原点は布の上辺の中心
 */
function drape(width: number, height: number, folds: number, amp: number, gather?: { y: number; side: number }) {
  const geom = new THREE.PlaneGeometry(width, height, folds * 8, 16);
  geom.translate(0, -height / 2, 0);
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    const y = p.getY(i);
    const u = x / width + 0.5;
    let k = 1;
    if (gather) {
      const d = (y - gather.y) / height;
      k = 1 - 0.65 * Math.exp(-(d * d) / 0.02);
      const edge = (gather.side * width) / 2;
      x = edge + (x - edge) * k;
    }
    p.setXYZ(i, x, y, (amp / Math.max(k, 0.35)) * (0.5 + 0.5 * Math.sin(u * folds * Math.PI * 2)));
  }
  geom.computeVertexNormals();
  return geom;
}

const curtainCloth = (color: string, weave: THREE.Texture, sheen: number) => {
  const m = cloth(color, weave, 2, sheen);
  m.side = THREE.DoubleSide;
  return m;
};

/** 下の縁を波形に切り抜いたバランス（カーテンの上の飾り布）の抜き型 */
function scallopMask() {
  return paint(256, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 34);
    for (let x = 0; x < 256; x += 32) {
      g.beginPath();
      g.arc(x + 16, 34, 16, 0, Math.PI);
      g.fill();
    }
  });
}

/**
 * 窓まわり。原点は窓の中心で +z が部屋の中。w と h は窓の大きさ。
 * 布の下端は窓の下から少しだけ下げ、窓の下の棚にかからないようにする
 */
export function windowDressing(theme: RoomTheme, w: number, h: number, weave: THREE.Texture) {
  const g = new THREE.Group();
  if (theme === 'natural') return g;
  if (theme === 'wafu') return shoji(w, h);
  const top = h / 2 + 0.12;
  const len = h + 0.2;
  const rod = mesh(
    cyl(0.012, 0.012, w + 0.7, 12),
    theme === 'nordic' ? mat('#2b2a28', { roughness: 0.5 }) : theme === 'pink' ? mat('#ffffff') : gold(),
    0,
    top,
    0.1,
    false
  );
  rod.rotation.z = Math.PI / 2;
  g.add(rod);
  for (const s of [-1, 1])
    g.add(mesh(sphere(0.03, 12, 8), theme === 'nordic' ? mat('#2b2a28') : gold(), s * (w / 2 + 0.36), top, 0.1, false));

  const color = { pink: '#f6a8c2', nordic: '#eee8dc', castle: '#8a1a2c' }[theme];
  const panelW = theme === 'castle' ? 0.46 : 0.4;
  const fabric = curtainCloth(color, weave, theme === 'nordic' ? 0.4 : 1);
  for (const s of [-1, 1]) {
    const gather = theme === 'nordic' ? undefined : { y: -len * 0.62, side: s };
    const panel = new THREE.Mesh(drape(panelW, len, 4, 0.035, gather), fabric);
    panel.position.set(s * (w / 2 + 0.1), top - 0.02, 0.12);
    panel.castShadow = panel.receiveShadow = true;
    g.add(panel);
    if (gather) {
      const tieX = s * (w / 2 + 0.1 + panelW * 0.33);
      const tieY = top - 0.02 - len * 0.62;
      if (theme === 'pink') {
        const knot = bow(cloth('#e45a8b', weave, 1, 1), 0.06);
        knot.position.set(tieX, tieY, 0.2);
        g.add(knot);
      } else {
        const rope = mesh(torus(0.07, 0.012, 8, 20), gold(), tieX, tieY, 0.14, false);
        rope.scale.set(1, 0.5, 1);
        rope.rotation.x = Math.PI / 2;
        g.add(rope);
        const tassel = mesh(
          geo('tassel', () => new THREE.ConeGeometry(0.025, 0.1, 10)),
          gold(),
          tieX,
          tieY - 0.08,
          0.2
        );
        g.add(tassel);
      }
    }
  }
  if (theme === 'pink') {
    const sheer = new THREE.MeshStandardMaterial({
      map: lace(),
      color: '#ffffff',
      alphaTest: 0.4,
      roughness: 0.9,
      side: THREE.DoubleSide
    });
    sheer.map = sheer.map!.clone();
    sheer.map.repeat.set(4, 5);
    const veil = new THREE.Mesh(drape(w + 0.15, len - 0.04, 9, 0.015), sheer);
    veil.position.set(0, top - 0.03, 0.07);
    g.add(veil);
  }
  if (theme !== 'nordic') {
    const mask = scallopMask();
    const valance = new THREE.Mesh(
      drape(w + 0.62, 0.24, 8, 0.02),
      Object.assign(curtainCloth(color, weave, 1), { alphaMap: mask, alphaTest: 0.5 })
    );
    valance.position.set(0, top + 0.07, 0.16);
    g.add(valance);
    if (theme === 'castle')
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * ((w + 0.5) / 4);
        g.add(
          mesh(
            geo('tassel', () => new THREE.ConeGeometry(0.025, 0.1, 10)),
            gold(),
            x,
            top - 0.14,
            0.17,
            false
          )
        );
      }
  }
  return g;
}

/** 障子。2 枚を左へ寄せて重ね、右半分から外の景色をのぞかせる。紙は外の明るさで光って見せる */
function shoji(w: number, h: number) {
  const g = new THREE.Group();
  const wood = mat('#c9a877', { roughness: 0.6 });
  const paper = new THREE.MeshStandardMaterial({
    map: shojiPaper(),
    emissive: '#fff1d8',
    emissiveIntensity: 0.35,
    roughness: 0.95
  });
  const pw = w / 2 + 0.06;
  const ph = h + 0.1;
  for (const [x, z] of [
    [-w / 4 - 0.03, 0.04],
    [-w / 4 + 0.08, 0.075]
  ]) {
    const panel = new THREE.Group();
    panel.add(mesh(new THREE.PlaneGeometry(pw, ph), paper, 0, 0, 0, false));
    const t = 0.025;
    for (const s of [-1, 1]) {
      panel.add(mesh(box(t, ph, 0.03), wood, (s * (pw - t)) / 2, 0, 0.005, false));
      panel.add(mesh(box(pw, t, 0.03), wood, 0, (s * (ph - t)) / 2, 0.005, false));
    }
    for (let i = 1; i < 3; i++) panel.add(mesh(box(0.008, ph, 0.012), wood, -pw / 2 + (i * pw) / 3, 0, 0.004, false));
    for (let j = 1; j < 5; j++) panel.add(mesh(box(pw, 0.008, 0.012), wood, 0, -ph / 2 + (j * ph) / 5, 0.004, false));
    panel.position.set(x, 0, z);
    g.add(panel);
  }
  for (const y of [h / 2 + 0.08, -h / 2 - 0.08]) g.add(mesh(box(w + 0.2, 0.06, 0.14), wood, 0, y, 0.06, false));
  return g;
}

/** 額の絵。canvas に描いて、枠を 4 本の角材で囲む */
function framed(w: number, h: number, frame: THREE.Material, draw: (g: CanvasRenderingContext2D) => void) {
  const g = new THREE.Group();
  const art = paint(256, Math.round((256 * h) / w), draw);
  g.add(
    mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 }),
      0,
      0,
      0.012,
      false
    )
  );
  const t = Math.min(w, h) * 0.09;
  for (const s of [-1, 1]) {
    g.add(mesh(box(w + t * 2, t, 0.03), frame, 0, s * (h / 2 + t / 2), 0.015, false));
    g.add(mesh(box(t, h, 0.03), frame, s * (w / 2 + t / 2), 0, 0.015, false));
  }
  return g;
}

/**
 * ソファの上の壁の飾り。原点は奥の壁の上で、ソファの中心の真上。
 * いつものカメラから奥の壁が見えるのは高さ 1.2m くらいまでなので、ソファの背のすぐ上に掛ける。
 * ピンクは三角の旗のガーランド、わしつは掛け軸、ほくおうは 2 枚の額、おしろは金の額の紋章
 */
export function wallDecor(theme: RoomTheme) {
  const g = new THREE.Group();
  if (theme === 'pink') {
    const flags = ['#f58bb2', '#ffffff', '#d9c6ff', '#ffd0e0', '#ec6f9c'];
    const tri = geo('bunting', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.075, 0);
      s.lineTo(0.075, 0);
      s.lineTo(0, -0.16);
      s.closePath();
      return new THREE.ShapeGeometry(s);
    });
    const points: THREE.Vector3[] = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = -0.85 + u * 1.7;
      // ひもは両端で留めてまん中が垂れる
      const y = 1.14 - 0.1 * Math.sin(u * Math.PI);
      points.push(new THREE.Vector3(x, y, 0.03));
      const f = mesh(tri, mat(flags[i % flags.length], { roughness: 0.8, side: THREE.DoubleSide }), x, y, 0.035, false);
      f.rotation.z = Math.cos(u * Math.PI) * 0.25;
      g.add(f);
      if (i % 2 === 0) g.add(mesh(sphere(0.018, 10, 8), '#ffffff', x, y - 0.02, 0.05, false));
    }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.004, 5), '#f7f1f3', 0, 0, 0, false));
    return g;
  }
  if (theme === 'wafu') {
    const scroll = framed(0.36, 0.82, mat('#3b2a1c', { roughness: 0.6 }), (c) => {
      c.fillStyle = '#efe6d2';
      c.fillRect(0, 0, 256, 580);
      c.fillStyle = '#b89a6a';
      c.fillRect(0, 0, 256, 70);
      c.fillRect(0, 510, 256, 70);
      c.strokeStyle = '#2a2622';
      c.lineWidth = 16;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(128, 250, 80, 0.4, Math.PI * 2 - 0.2);
      c.stroke();
      c.fillStyle = '#b8272c';
      c.fillRect(170, 420, 26, 26);
    });
    scroll.position.set(0, 1.08, 0);
    g.add(scroll);
    return g;
  }
  if (theme === 'nordic') {
    const oak = mat('#c79f72', { roughness: 0.55 });
    const prints: [number, (c: CanvasRenderingContext2D) => void][] = [
      [
        -0.28,
        (c) => {
          c.fillStyle = '#f4efe6';
          c.fillRect(0, 0, 256, 320);
          c.fillStyle = '#d3a24a';
          c.beginPath();
          c.arc(128, 130, 70, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#8ea4b3';
          c.fillRect(40, 200, 176, 80);
        }
      ],
      [
        0.28,
        (c) => {
          c.fillStyle = '#f4efe6';
          c.fillRect(0, 0, 256, 320);
          c.strokeStyle = '#3a3836';
          c.lineWidth = 6;
          for (let i = 0; i < 5; i++) {
            c.beginPath();
            c.moveTo(128, 280);
            c.quadraticCurveTo(128 + (i - 2) * 30, 160, 128 + (i - 2) * 50, 60 + Math.abs(i - 2) * 30);
            c.stroke();
          }
        }
      ]
    ];
    for (const [x, draw] of prints) {
      const f = framed(0.28, 0.34, oak, draw);
      f.position.set(x, 1.1, 0);
      g.add(f);
    }
    return g;
  }
  if (theme === 'castle') {
    const crest = framed(0.62, 0.5, gold(), (c) => {
      c.fillStyle = '#1f2a4d';
      c.fillRect(0, 0, 256, 206);
      c.fillStyle = '#d8ac52';
      c.beginPath();
      c.moveTo(88, 150);
      c.lineTo(78, 70);
      c.lineTo(104, 100);
      c.lineTo(128, 56);
      c.lineTo(152, 100);
      c.lineTo(178, 70);
      c.lineTo(168, 150);
      c.closePath();
      c.fill();
      c.fillStyle = '#b02a3a';
      for (const x of [104, 128, 152]) {
        c.beginPath();
        c.arc(x, 132, 7, 0, Math.PI * 2);
        c.fill();
      }
    });
    crest.position.set(0, 1.32, 0);
    g.add(crest);
  }
  return g;
}
