import * as THREE from 'three';
import { fromHex, type RGB } from './color';
import { rng } from './rng';

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

export function make(
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
    g.lineWidth = 9;
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
      g.lineWidth = 9;
      g.strokeRect(x, 282 - h, w, h);
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#6a4a2c' : '#8a6a44';
      g.fillRect(30 + i * 26, 282 - (i + 1) * 26, 200 - i * 14, 26);
    }
    g.strokeStyle = '#2c2416';
    g.lineWidth = 9;
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

/** 大広間の濃い茶の板張り。縦の板 4 枚（1 枚 15cm）に木目と板の継ぎ目 */
export function woodPanel(): Pattern {
  return make('wood-panel', 256, 512, [0.6, 1.2], (g) => {
    const r = rng(5);
    for (let i = 0; i < 4; i++) {
      const base = 22 + r() * 8;
      g.fillStyle = `hsl(24 45% ${base}%)`;
      g.fillRect(i * 64, 0, 64, 512);
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `hsl(22 40% ${base - 7 + r() * 6}% / 0.7)`;
        g.lineWidth = 9 + r() * 5;
        g.beginPath();
        const x0 = i * 64 + 6 + r() * 52;
        g.moveTo(x0, 0);
        for (let y = 0; y <= 512; y += 32) g.lineTo(x0 + Math.sin(y / 70 + k) * 4, y);
        g.stroke();
      }
      g.fillStyle = '#1a0f08';
      g.fillRect(i * 64, 0, 9, 512);
    }
  });
}

/** 緑の廊下の腰の羽目板（高さ 1m）。木の枠に、一段下がった鏡板 */
export function wainscot(): Pattern {
  return make('wainscot', 512, 427, [1.2, 1.0], (g) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, 512, 427);
    g.fillStyle = '#3e2615';
    g.fillRect(0, 0, 512, 34);
    for (const x of [26, 282]) {
      g.fillStyle = '#4a2e1a';
      g.fillRect(x, 64, 204, 320);
      g.strokeStyle = '#7a5434';
      g.lineWidth = 9;
      g.strokeRect(x + 16, 80, 172, 288);
      g.strokeStyle = '#2a190c';
      g.lineWidth = 9;
      g.strokeRect(x + 5, 69, 194, 310);
    }
  });
}

/** 大広間の木の格天井。梁の格子と、くぼんだ升の真ん中に金の花 */
export function coffer(): Pattern {
  return make('coffer', 512, 512, [1.5, 1.5], (g) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#3b2414';
    g.fillRect(48, 48, 416, 416);
    g.strokeStyle = '#7a5434';
    g.lineWidth = 10;
    g.strokeRect(80, 80, 352, 352);
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.arc(256, 256, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a6a1a';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(
        256 + Math.cos((i * Math.PI) / 4) * 58,
        256 + Math.sin((i * Math.PI) / 4) * 58,
        18,
        9,
        (i * Math.PI) / 4,
        0,
        Math.PI * 2
      );
      g.fill();
    }
  });
}

/** 大広間の床。クリームの大理石（1 枚 60cm）に灰色の筋と、目地の交わりに黒い菱形 */
export function marble(): Pattern {
  return make('marble', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(17);
    g.fillStyle = '#e9e0cf';
    g.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgb(120 110 100 / ${0.1 + r() * 0.12})`;
      g.lineWidth = 9 + r() * 5;
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let s = 0; s < 12; s++) {
        x += (r() - 0.3) * 60;
        y += (r() - 0.5) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = '#b8ad9a';
    g.lineWidth = 9;
    for (const v of [0, 256, 512]) {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, 512);
      g.moveTo(0, v);
      g.lineTo(512, v);
      g.stroke();
    }
    g.fillStyle = '#151311';
    for (const x of [0, 256, 512])
      for (const y of [0, 256, 512]) {
        g.beginPath();
        g.moveTo(x, y - 34);
        g.lineTo(x + 34, y);
        g.lineTo(x, y + 34);
        g.lineTo(x - 34, y);
        g.fill();
      }
  });
}

/** ピアノの下の赤い柄の絨毯（2.4m × 3.6m を 1 枚で） */
export function rug(): Pattern {
  return make('rug', 512, 768, [2.4, 3.6], (g) => {
    g.fillStyle = '#8e1b1b';
    g.fillRect(0, 0, 512, 768);
    g.strokeStyle = '#1f2a4d';
    g.lineWidth = 34;
    g.strokeRect(17, 17, 478, 734);
    g.strokeStyle = '#c9a227';
    g.lineWidth = 10;
    g.strokeRect(46, 46, 420, 676);
    g.fillStyle = '#1f2a4d';
    g.beginPath();
    g.ellipse(256, 384, 130, 200, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.ellipse(256, 384, 70, 110, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8e1b1b';
    g.beginPath();
    g.ellipse(256, 384, 30, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a227';
    for (const [x, y] of [
      [110, 140],
      [402, 140],
      [110, 628],
      [402, 628]
    ]) {
      g.beginPath();
      g.arc(x, y, 26, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 本棚の 1 段（幅 1.2m、高さ 47cm）。背表紙は 3〜6cm 幅で、上下に金の帯 */
export function books(): Pattern {
  return make('books', 512, 200, [1.2, 0.47], (g) => {
    const r = rng(31);
    const colors = [
      '#7a1f2b',
      '#2f4f6f',
      '#3e5b3a',
      '#b87333',
      '#d8c39a',
      '#1d1a17',
      '#6b2d5c',
      '#c9a227',
      '#8b5a2b',
      '#efe6d2'
    ];
    g.fillStyle = '#24160c';
    g.fillRect(0, 0, 512, 200);
    let x = 4;
    while (x < 500) {
      const w = Math.min(500 - x, 13 + Math.floor(r() * 13));
      const h = 120 + Math.floor(r() * 54);
      const c = colors[Math.floor(r() * colors.length)];
      g.fillStyle = c;
      g.fillRect(x, 184 - h, w - 2, h);
      g.fillStyle = '#d4af37';
      g.fillRect(x, 184 - h + 8, w - 2, 9);
      g.fillRect(x, 184 - 20, w - 2, 9);
      if (r() < 0.4) {
        g.fillStyle = 'rgb(0 0 0 / 0.35)';
        g.fillRect(x + 2, 184 - h + 34, w - 6, 18);
      }
      x += w;
    }
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 184, 512, 16);
  });
}

/** 緑の廊下の古いポスター（人物の絵と文字の帯） */
export function poster(): Pattern {
  return make('poster', 256, 384, [0.5, 0.75], (g) => {
    const r = rng(43);
    g.fillStyle = '#d9c9a3';
    g.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgb(120 90 50 / ${r() * 0.12})`;
      g.beginPath();
      g.arc(r() * 256, r() * 384, 10 + r() * 40, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#5b3a24';
    g.fillRect(28, 26, 200, 26);
    g.beginPath();
    g.arc(128, 150, 46, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(128, 270, 90, 70, 0, Math.PI, 0);
    g.fill();
    g.fillRect(48, 300, 160, 14);
    g.fillRect(70, 326, 116, 11);
    g.strokeStyle = '#5b3a24';
    g.lineWidth = 11;
    g.strokeRect(12, 12, 232, 360);
  });
}

/** チェスターフィールドのソファの茶色の革。菱形に並んだ鋲のくぼみ */
export function leather(): Pattern {
  return make('leather', 256, 256, [0.4, 0.4], (g) => {
    const r = rng(53);
    g.fillStyle = '#6b3f22';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgb(${r() < 0.5 ? '40 20 10' : '140 90 55'} / 0.08)`;
      g.fillRect(r() * 256, r() * 256, 14, 14);
    }
    for (const [x, y] of [
      [0, 0],
      [128, 128],
      [256, 0],
      [0, 256],
      [256, 256]
    ]) {
      const grad = g.createRadialGradient(x, y, 2, x, y, 60);
      grad.addColorStop(0, 'rgb(20 10 5 / 0.7)');
      grad.addColorStop(1, 'rgb(20 10 5 / 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 60, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 本家のハンターの銃と絵筆の柄の、虹色のペンキのまだら */
export function rainbowMottle(): Pattern {
  return make('rainbow', 128, 128, [0.12, 0.12], (g) => {
    const r = rng(61);
    g.fillStyle = '#f4efe6';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `hsl(${Math.floor(r() * 360)} 85% 55%)`;
      g.beginPath();
      g.ellipse(r() * 128, r() * 128, 6 + r() * 14, 4 + r() * 8, r() * Math.PI, 0, Math.PI * 2);
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
    // transformUv は flipY のとき v を上下逆にして返すので、その場合は行へそのまま使う
    const v = t.y - Math.floor(t.y);
    const x = Math.min(w - 1, Math.floor((t.x - Math.floor(t.x)) * w));
    const y = Math.min(h - 1, Math.floor((map.flipY ? v : 1 - v) * h));
    const i = (y * w + x) * 4;
    color = [(data[i] / 255) * color[0], (data[i + 1] / 255) * color[1], (data[i + 2] / 255) * color[2]];
  }
  return { color, metal: pick.metal, rough: pick.rough };
}
