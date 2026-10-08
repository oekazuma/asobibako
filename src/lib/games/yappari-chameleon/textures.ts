import * as THREE from 'three';
import { fromHex, type RGB } from './color';

export interface PickInfo {
  image: ImageData | null;
  tint: RGB;
  metal: number;
  rough: number;
}

export interface Pattern {
  canvas: HTMLCanvasElement;
  image: ImageData;
  /** 模様 1 枚が覆う大きさ（m）。面の大きさで割った回数だけ繰り返す */
  meters: [number, number];
}

const made = new Map<string, Pattern>();

function make(
  key: string,
  w: number,
  h: number,
  meters: [number, number],
  draw: (g: CanvasRenderingContext2D) => void
): Pattern {
  const old = made.get(key);
  if (old) return old;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  draw(g);
  const p = { canvas, image: g.getImageData(0, 0, w, h), meters };
  made.set(key, p);
  return p;
}

/** 種から作る乱数。模様は開くたびに同じにする（スポイトで取った色が変わらないように） */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ダマスク柄（本家の屋敷の緑・青・赤の壁紙）。左右対称の飾りを、半分を描いて左右に写して作る。
 * 線は 2cm 以上の太さにして、体に写せるようにする
 */
export function damask(ground: string, ink: string): Pattern {
  return make(`damask:${ground}:${ink}`, 256, 384, [0.5, 0.75], (g) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, 256, 384);
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineWidth = 11;
    g.lineCap = 'round';
    const leaf = (x: number, y: number, len: number, wid: number, rot: number) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(wid, len * 0.5, 0, len);
      g.quadraticCurveTo(-wid, len * 0.5, 0, 0);
      g.fill();
      g.restore();
    };
    // 本家の壁紙は線ではなく、鳥と葉を塗りつぶした面の多い飾り。中心から左右に写す
    for (const flip of [1, -1]) {
      g.save();
      g.translate(128, 0);
      g.scale(flip, 1);
      g.beginPath();
      g.moveTo(0, 18);
      g.bezierCurveTo(78, 70, 78, 150, 22, 196);
      g.bezierCurveTo(-8, 228, 22, 292, 66, 334);
      g.stroke();
      leaf(42, 56, 62, 26, -0.7);
      leaf(62, 128, 72, 30, 0.5);
      leaf(34, 226, 58, 24, -0.4);
      leaf(70, 290, 62, 26, 0.8);
      // 葉の陰にとまる鳥（体・頭・尾・翼）
      g.beginPath();
      g.ellipse(84, 178, 30, 15, -0.3, 0, Math.PI * 2);
      g.arc(108, 164, 11, 0, Math.PI * 2);
      g.moveTo(58, 186);
      g.lineTo(26, 206);
      g.lineTo(34, 178);
      g.fill();
      g.beginPath();
      g.moveTo(74, 172);
      g.quadraticCurveTo(84, 140, 112, 132);
      g.quadraticCurveTo(100, 166, 90, 182);
      g.fill();
      g.restore();
    }
    g.beginPath();
    g.ellipse(128, 192, 24, 44, 0, 0, Math.PI * 2);
    g.fill();
    // 隣の飾りと合わせるため、四隅に半分ずつ花を置く
    for (const [x, y] of [
      [0, 0],
      [256, 0],
      [0, 384],
      [256, 384]
    ]) {
      g.beginPath();
      g.arc(x, y, 28, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 白黒の市松の床（1 枡 0.3m）。目地の線と、少しのむらを入れる */
export function checker(): Pattern {
  return make('checker', 256, 256, [0.6, 0.6], (g) => {
    const r = rng(11);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#1d1c1b' : '#efebe2';
        g.fillRect(i * 128, j * 128, 128, 128);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = (i + j) % 2 ? 'rgb(255 255 255 / 0.03)' : 'rgb(0 0 0 / 0.03)';
          g.fillRect(i * 128 + r() * 128, j * 128 + r() * 128, 6 + r() * 18, 6 + r() * 18);
        }
      }
    g.strokeStyle = '#8a8580';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 128, 128);
    g.strokeRect(128, 128, 128, 128);
    g.strokeRect(128, 0, 128, 128);
    g.strokeRect(0, 128, 128, 128);
  });
}

/**
 * 金の額に入れる油絵。本家のトレーラーで体に写していた絵に寄せ、灰色がかった緑とオリーブを主に、
 * 左に上がる茶の階段、右に扉の並ぶ廊下、手前に明るいベージュの床を置く
 */
export function oilPainting(): Pattern {
  return make('oil', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(23);
    const wall = g.createLinearGradient(0, 0, 0, 384);
    wall.addColorStop(0, '#4c5039');
    wall.addColorStop(0.6, '#6e7653');
    wall.addColorStop(1, '#393f27');
    g.fillStyle = wall;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#a59863';
    g.fillRect(0, 0, 512, 42);
    g.fillStyle = '#b9ab78';
    g.beginPath();
    g.moveTo(0, 384);
    g.lineTo(512, 384);
    g.lineTo(404, 282);
    g.lineTo(108, 282);
    g.fill();
    for (let i = 0; i < 4; i++) {
      const w = 40 - i * 6;
      const h = 150 - i * 22;
      const x = 300 + i * 48;
      g.fillStyle = '#393f27';
      g.fillRect(x, 282 - h, w, h);
      g.strokeStyle = '#a59863';
      g.lineWidth = 5;
      g.strokeRect(x, 282 - h, w, h);
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#6a4a2c' : '#8a6a44';
      g.fillRect(30 + i * 26, 282 - (i + 1) * 26, 200 - i * 14, 26);
    }
    g.strokeStyle = '#2c2416';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(26, 272);
    g.lineTo(240, 64);
    g.stroke();
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `hsl(${65 + r() * 25} ${10 + r() * 20}% ${25 + r() * 40}% / 0.18)`;
      g.beginPath();
      g.ellipse(r() * 512, r() * 384, 6 + r() * 16, 3 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export interface Finish {
  pattern?: Pattern;
  tint?: string;
  metal?: number;
  rough?: number;
}

/** 面の大きさ（m）に合わせて模様を繰り返した材質。スポイトで読むための画素を userData.pick に持たせる */
export function finish(f: Finish, size: [number, number]): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: f.tint ?? '#ffffff',
    metalness: f.metal ?? 0,
    roughness: f.rough ?? 0.8
  });
  if (f.pattern) {
    const t = new THREE.CanvasTexture(f.pattern.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size[0] / f.pattern.meters[0], size[1] / f.pattern.meters[1]);
    t.anisotropy = 4;
    m.map = t;
  }
  const pick: PickInfo = {
    image: f.pattern?.image ?? null,
    tint: fromHex(f.tint ?? '#ffffff'),
    metal: f.metal ?? 0,
    rough: f.rough ?? 0.8
  };
  m.userData.pick = pick;
  return m;
}

/** 光が当たる前の物の色（模様の画素 × 材質の色）。体にも同じ光が当たるので、同じ場所では同じに見える */
export function readPick(
  m: THREE.Material,
  uv: THREE.Vector2 | undefined
): { color: RGB; metal: number; rough: number } | null {
  const pick = m.userData.pick as PickInfo | undefined;
  if (!pick) return null;
  let color: RGB = [...pick.tint];
  const map = (m as THREE.MeshStandardMaterial).map;
  if (pick.image && uv && map) {
    const { width: w, height: h, data } = pick.image;
    // 描くときと同じ繰り返し・ずらし・回しにして、模様の 1 枚の中の位置に畳む。canvas の行は上から数える
    map.updateMatrix();
    const t = map.transformUv(uv.clone());
    const x = Math.min(w - 1, Math.floor((t.x - Math.floor(t.x)) * w));
    const y = Math.min(h - 1, Math.floor((1 - (t.y - Math.floor(t.y))) * h));
    const i = (y * w + x) * 4;
    color = [(data[i] / 255) * color[0], (data[i + 1] / 255) * color[1], (data[i + 2] / 255) * color[2]];
  }
  return { color, metal: pick.metal, rough: pick.rough };
}
