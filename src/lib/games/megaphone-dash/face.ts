import * as THREE from 'three';

/**
 * アニメ調の顔。目・まぶた・瞳・光・頬の赤み・口は canvas に絵として描き、頭の前面に沿わせた薄い殻に貼る。
 * 目を球で作るとシールを貼ったように浮いて見えるので、絵にして頭の丸みに沿わせる
 */

/** 頭の楕円体（chara.ts の頭の形と同じ半径）。殻はこれより少しだけ大きくする */
export const HEAD = { rx: 0.26, ry: 0.235, rz: 0.235 };

export interface Look {
  /** 瞳の色 */
  iris: string;
  /** 星形の瞳孔（主人公の目印） */
  star?: boolean;
  /** 口の形 */
  mouth: 'o' | 'smile';
}

const SIZE = 512;

/** 顔の横の位置 x・縦の位置 y（頭の中心からの m）を、絵の上の画素へ */
const toPx = (x: number, y: number): [number, number] => [
  SIZE / 2 + (x / (2 * HEAD.rx)) * SIZE,
  SIZE / 2 - (y / (2 * HEAD.ry)) * SIZE
];

function eye(g: CanvasRenderingContext2D, cx: number, cy: number, side: number, look: Look) {
  const w = 44;
  const h = 56;
  // 白目
  g.fillStyle = '#fffaf6';
  g.beginPath();
  g.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
  g.fill();
  // 瞳。上ほど濃く、下へ明るくして奥行きを出す
  const grad = g.createLinearGradient(cx, cy - h, cx, cy + h);
  const iris = new THREE.Color(look.iris);
  grad.addColorStop(0, `#${iris.clone().multiplyScalar(0.45).getHexString()}`);
  grad.addColorStop(0.55, look.iris);
  grad.addColorStop(1, `#${iris.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString()}`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy + 6, w * 0.6, h * 0.68, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = `#${iris.clone().multiplyScalar(0.35).getHexString()}`;
  g.lineWidth = 4;
  g.stroke();
  // 瞳孔。主人公は放射状の星、ほかの子は丸
  g.fillStyle = `#${iris.clone().multiplyScalar(0.4).getHexString()}`;
  g.beginPath();
  if (look.star) {
    const n = 8;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 8 : 22;
      g.lineTo(cx + Math.cos(a) * r, cy + 6 + Math.sin(a) * r * 1.1);
    }
  } else g.ellipse(cx, cy + 8, 13, 17, 0, 0, Math.PI * 2);
  g.fill();
  // 光。大きい丸と小さい丸
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx + side * 10, cy - 14, 11, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx - side * 12, cy + 22, 5, 0, Math.PI * 2);
  g.fill();
  // 上まぶた。太い線を目の上に沿わせ、目じりを少しはね上げる
  g.strokeStyle = '#2a1d24';
  g.lineCap = 'round';
  g.lineWidth = 11;
  g.beginPath();
  g.ellipse(cx, cy + 2, w + 3, h + 1, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx + side * (w + 1), cy - 18);
  g.lineTo(cx + side * (w + 12), cy - 30);
  g.stroke();
  // 下まぶたは細く、目じり側だけ
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, cy, w, h, 0, Math.PI * (side > 0 ? 0.1 : 0.55), Math.PI * (side > 0 ? 0.45 : 0.9));
  g.stroke();
}

const textures = new Map<string, THREE.CanvasTexture>();

export function faceTexture(look: Look): THREE.CanvasTexture {
  const key = JSON.stringify(look);
  const hit = textures.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  // 頬の赤み。やわらかいオレンジのぼかし
  for (const side of [1, -1]) {
    const [bx, by] = toPx(side * 0.135, -0.095);
    const blush = g.createRadialGradient(bx, by, 4, bx, by, 60);
    blush.addColorStop(0, 'rgb(255 110 70 / 0.7)');
    blush.addColorStop(1, 'rgb(255 110 70 / 0)');
    g.fillStyle = blush;
    g.fillRect(bx - 70, by - 50, 140, 100);
  }
  for (const side of [1, -1]) {
    const [ex, ey] = toPx(side * 0.092, -0.03);
    eye(g, ex, ey, side, look);
  }
  const [mx, my] = toPx(0, -0.118);
  g.fillStyle = '#c24552';
  g.beginPath();
  if (look.mouth === 'o') g.ellipse(mx, my, 9, 10, 0, 0, Math.PI * 2);
  else {
    g.moveTo(mx - 16, my - 4);
    g.quadraticCurveTo(mx, my + 16, mx + 16, my - 4);
    g.closePath();
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(key, t);
  return t;
}

let shellGeo: THREE.BufferGeometry | null = null;

/**
 * 頭の前面を包む殻。頭の中心を原点に、少しだけ大きい楕円体を作り、前から見た位置で絵を貼る。
 * 後ろ半分は絵の透明な隅を指させて、何も描かれないようにする
 */
export function shell(): THREE.BufferGeometry {
  if (shellGeo) return shellGeo;
  const g = new THREE.SphereGeometry(1, 64, 48);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const k = 1.012;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * HEAD.rx * k;
    const y = pos.getY(i) * HEAD.ry * k;
    const z = pos.getZ(i) * HEAD.rz * k;
    pos.setXYZ(i, x, y, z);
    const front = pos.getZ(i) < -0.05;
    uv.setXY(i, front ? 0.5 + x / (2 * HEAD.rx) : 0.001, front ? 0.5 + y / (2 * HEAD.ry) : 0.999);
  }
  g.computeVertexNormals();
  shellGeo = g;
  return g;
}

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function faceMaterial(look: Look): THREE.MeshStandardMaterial {
  const key = JSON.stringify(look);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: faceTexture(look),
      transparent: true,
      roughness: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    materials.set(key, m);
  }
  return m;
}
