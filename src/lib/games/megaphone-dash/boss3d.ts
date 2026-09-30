import * as THREE from 'three';
import { bounds, field, mesh as surface, type Shape, type V3 } from '$lib/sculpt';

/**
 * ボス「ふきげんオニ」。濃い青灰色の大きな頭に、赤く枝分かれした角・光る赤い目・牙の並んだ口・細い腕。
 * 頭と腕はなめらかな 1 枚の形で作り、角・目・牙は別の形を重ねる。こちら（+z）を向く
 */

const ell = (a: V3, r: V3, tag: string, k = 0.08): Shape => ({ a, ell: r, bone: 'root', tag, k });
const cone = (a: V3, b: V3, ra: number, rb: number, tag: string, k = 0.06): Shape => ({
  a,
  cone: { b, ra, rb },
  bone: 'root',
  tag,
  k
});

const COLORS: Record<string, string> = { skin: '#4b5f7c', belly: '#8fa3bf', mouth: '#2a0f18' };

function shapes(): Shape[] {
  const s: Shape[] = [
    ell([0, 0, 0], [1.05, 0.95, 0.95], 'skin', 0.2),
    // あごと、その下の首。口の下を少し前へ出す
    ell([0, -0.55, 0.35], [0.7, 0.35, 0.55], 'skin', 0.25),
    ell([0, -1.0, 0.1], [0.32, 0.4, 0.3], 'belly', 0.2),
    // 口の穴
    { ...ell([0, -0.38, 0.88], [0.5, 0.2, 0.25], 'mouth', 0.05), cut: true }
  ];
  for (const side of [1, -1]) {
    // 眉のでっぱり。目の上を怒った形に張り出させる
    s.push(ell([side * 0.38, 0.3, 0.72], [0.34, 0.12, 0.2], 'skin', 0.12));
    // 細い腕と、下で広がる手
    s.push(cone([side * 0.55, -0.9, 0.2], [side * 1.0, -1.7, 0.45], 0.16, 0.11, 'skin', 0.1));
    s.push(ell([side * 1.02, -1.8, 0.5], [0.2, 0.14, 0.18], 'skin', 0.06));
  }
  return s;
}

let bodyGeo: THREE.BufferGeometry | null = null;

function body(): THREE.BufferGeometry {
  if (bodyGeo) return bodyGeo;
  const list = shapes();
  const f = field(list);
  const s = surface(f, bounds(list, 0.1), 0.05);
  const n = s.pos.length / 3;
  const colors = new Float32Array(n * 3);
  const d = new Float64Array(f.count);
  const c = new THREE.Color();
  for (let v = 0; v < n; v++) {
    f.each(s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2], d);
    let best = 0;
    for (let i = 0; i < list.length; i++) if (Math.abs(d[i]) < Math.abs(d[best])) best = i;
    c.set(COLORS[list[best].tag]);
    colors.set([c.r, c.g, c.b], v * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(s.idx, 1));
  bodyGeo = g;
  return g;
}

/** 体を法線の向きへ少しふくらませて裏だけを描く、ふち取り（骨で曲げない形用） */
function outline(width: number) {
  const m = new THREE.MeshBasicMaterial({ color: '#1a0f18', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n  transformed += normalize(normal) * ${width.toFixed(4)};`
    );
  };
  m.customProgramCacheKey = () => `static-outline-${width}`;
  return m;
}

export interface BossModel {
  group: THREE.Group;
  /** 当たったときに白く光らせる材質 */
  skin: THREE.MeshStandardMaterial;
  eyes: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function bossModel(): BossModel {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    emissive: '#ffffff',
    emissiveIntensity: 0
  });
  const line = outline(0.03);
  const g = body();
  group.add(new THREE.Mesh(g, skin), new THREE.Mesh(g, line));
  const eyes = new THREE.MeshStandardMaterial({ color: '#ff2a3d', emissive: '#ff1a30', emissiveIntensity: 1.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a0a10' });
  const white = new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.4 });
  const horn = new THREE.MeshStandardMaterial({
    color: '#c8243a',
    roughness: 0.5,
    emissive: '#5a0010',
    emissiveIntensity: 0.4
  });
  const made: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
    made.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    group.add(mesh);
    return mesh;
  };
  for (const side of [1, -1]) {
    // 目。赤く光る白目に、細い黒目
    add(new THREE.SphereGeometry(0.2, 20, 14), eyes, [side * 0.36, 0.08, 0.82], [0, 0, side * 0.3], [1, 0.75, 0.5]);
    add(new THREE.SphereGeometry(0.06, 12, 8), dark, [side * 0.34, 0.07, 0.93], [0, 0, 0], [0.6, 1.4, 0.5]);
    // 枝分かれした角。太い幹から外へ 2 本の枝
    const base: V3 = [side * 0.55, 0.75, 0];
    add(
      new THREE.CylinderGeometry(0.05, 0.13, 0.9, 10),
      horn,
      [base[0] + side * 0.18, base[1] + 0.35, base[2]],
      [0, 0, -side * 0.45]
    );
    add(
      new THREE.CylinderGeometry(0.02, 0.06, 0.5, 8),
      horn,
      [base[0] + side * 0.55, base[1] + 0.55, 0.05],
      [0, 0, -side * 1.1]
    );
    add(
      new THREE.CylinderGeometry(0.02, 0.05, 0.45, 8),
      horn,
      [base[0] + side * 0.3, base[1] + 0.85, -0.05],
      [0.2, 0, -side * 0.1]
    );
    // 大きな牙を口の両端から上へ
    add(new THREE.ConeGeometry(0.08, 0.36, 10), white, [side * 0.42, -0.34, 0.86], [0.2, 0, side * 0.35]);
  }
  // 口の中の小さな牙の列
  for (let i = 0; i < 5; i++)
    add(new THREE.ConeGeometry(0.045, 0.14, 8), white, [-0.24 + i * 0.12, -0.26, 0.93], [Math.PI, 0, 0]);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return {
    group,
    skin,
    eyes,
    dispose: () => {
      for (const g2 of made) g2.dispose();
      for (const m of [skin, line, eyes, dark, white, horn]) m.dispose();
    }
  };
}

/** ボスの場面の、赤い線の格子の壁。1 枚で 2 m 四方 */
export function gridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#12060a';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#ff2a3d';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 250);
  g.strokeStyle = 'rgb(255 42 61 / 0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.moveTo(0, 128);
  g.lineTo(256, 128);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
