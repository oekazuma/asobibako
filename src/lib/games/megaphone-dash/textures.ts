import * as THREE from 'three';

/**
 * 地面と建物の質感を canvas に描いた絵。素材の画像は使わず、ここで描いて使い回す。
 * どれも 1 枚が現実の何 m ぶんかを決めてあり、材質の repeat はその大きさで割って決める
 */

const made = new Map<string, THREE.CanvasTexture>();

/** 決まった乱数。毎回同じ絵にする */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void) {
  const hit = made.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, rng(key.length * 97 + w));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  made.set(key, t);
  return t;
}

/** 細かい点をまいて、ざらつきとむらを付ける */
function grain(
  g: CanvasRenderingContext2D,
  r: () => number,
  w: number,
  h: number,
  n: number,
  dark: number,
  light: number
) {
  for (let i = 0; i < n; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgb(0 0 0 / ${dark * r()})` : `rgb(255 255 255 / ${light * r()})`;
    const s = 1 + r() * 2.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

/** アスファルト。1 枚で 4 m 四方 */
export const asphalt = () =>
  paint('asphalt', 512, 512, (g, r) => {
    g.fillStyle = '#5d6168';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgb(${40 + r() * 30} ${42 + r() * 30} ${48 + r() * 30} / 0.18)`;
      g.beginPath();
      g.arc(r() * 512, r() * 512, 20 + r() * 70, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, r, 512, 512, 9000, 0.35, 0.25);
    g.strokeStyle = 'rgb(20 22 26 / 0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) g.lineTo((x += (r() - 0.5) * 40), (y += (r() - 0.5) * 40));
      g.stroke();
    }
  });

/** 歩道の四角いタイル。1 枚で 2 m 四方（30cm 角のタイル） */
export const tiles = () =>
  paint('tiles', 512, 512, (g, r) => {
    const n = 7;
    const s = 512 / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const v = 150 + r() * 22;
        g.fillStyle = `rgb(${v} ${v + 2} ${v + 6})`;
        g.fillRect(i * s, j * s, s, s);
      }
    grain(g, r, 512, 512, 6000, 0.2, 0.2);
    g.strokeStyle = 'rgb(70 72 78 / 0.8)';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, 512);
      g.moveTo(0, i * s);
      g.lineTo(512, i * s);
      g.stroke();
    }
  });

/** 黄色い点字ブロック（線状）。1 枚で 30cm × 30cm */
export const tactile = () =>
  paint('tactile', 128, 128, (g) => {
    g.fillStyle = '#e8b21c';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f6c93a';
    for (const x of [22, 64, 106]) {
      g.fillRect(x - 9, 6, 18, 116);
      g.fillStyle = 'rgb(120 80 0 / 0.35)';
      g.fillRect(x + 7, 6, 3, 116);
      g.fillStyle = '#f6c93a';
    }
    g.strokeStyle = 'rgb(120 80 0 / 0.5)';
    g.lineWidth = 3;
    g.strokeRect(1, 1, 126, 126);
  });

/** コンクリートの縁石と、白線 */
export const concrete = () =>
  paint('concrete', 256, 256, (g, r) => {
    g.fillStyle = '#b9b7b1';
    g.fillRect(0, 0, 256, 256);
    grain(g, r, 256, 256, 3000, 0.25, 0.25);
  });

const FACADES = ['#c9ccd1', '#b4b8be', '#d8d2c6', '#aeb4ad', '#c7c0b8', '#bfc7cf'];

/**
 * 建物の正面。1 枚で幅 8m・高さ 12m。1 階は入口と看板、上の階は窓の並びとベランダの手すり。
 * 下ほど汚れて暗くし、建物の足もとが地面になじむようにする
 */
export function facade(seed: number) {
  const k = ((seed % 6) + 6) % 6;
  return paint(`facade:${k}`, 512, 768, (g, r) => {
    const px = 512 / 8;
    g.fillStyle = FACADES[k];
    g.fillRect(0, 0, 512, 768);
    grain(g, r, 512, 768, 5000, 0.18, 0.18);
    // 打ちっぱなしのパネルの目地
    g.strokeStyle = 'rgb(0 0 0 / 0.08)';
    g.lineWidth = 2;
    for (let y = 0; y < 768; y += px * 1.5) g.strokeRect(0, y, 512, px * 1.5);
    const floors = 4;
    for (let f = 1; f < floors; f++) {
      const y = 768 - (f + 1) * px * 3 + px * 0.9;
      const cols = k % 2 ? 3 : 2;
      for (let c = 0; c < cols; c++) {
        const w = 512 / cols;
        const x = c * w + w * 0.12;
        const ww = w * 0.76;
        // 窓。空を映して上ほど明るく、中に枠
        const grad = g.createLinearGradient(0, y, 0, y + px * 1.6);
        grad.addColorStop(0, '#dff1ff');
        grad.addColorStop(1, '#6f8fa8');
        g.fillStyle = '#3d4450';
        g.fillRect(x - 5, y - 5, ww + 10, px * 1.6 + 10);
        g.fillStyle = grad;
        g.fillRect(x, y, ww, px * 1.6);
        g.fillStyle = '#3d4450';
        g.fillRect(x + ww / 2 - 2, y, 4, px * 1.6);
        // ベランダの手すり
        if ((k + f) % 3 !== 0) {
          g.fillStyle = 'rgb(240 240 236 / 0.92)';
          g.fillRect(x - 10, y + px * 1.15, ww + 20, px * 0.5);
          g.fillStyle = 'rgb(0 0 0 / 0.15)';
          g.fillRect(x - 10, y + px * 1.63, ww + 20, 4);
        }
        // エアコンの室外機
        if (r() < 0.35) {
          g.fillStyle = '#e9e9e4';
          g.fillRect(x + ww - px * 0.6, y + px * 1.2, px * 0.5, px * 0.38);
          g.strokeStyle = '#9aa0a6';
          g.beginPath();
          g.arc(x + ww - px * 0.35, y + px * 1.39, px * 0.12, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
    // 1 階。入口のガラス戸と、ひさし・看板
    const gy = 768 - px * 3;
    g.fillStyle = '#4a515c';
    g.fillRect(0, gy + px * 0.9, 512, px * 2.1);
    const glass = g.createLinearGradient(0, gy + px, 0, 768);
    glass.addColorStop(0, '#a9c9e0');
    glass.addColorStop(1, '#40505e');
    g.fillStyle = glass;
    g.fillRect(24, gy + px * 1.05, 512 - 48, px * 1.95);
    for (let x = 24; x < 490; x += 116) {
      g.fillStyle = '#5b636e';
      g.fillRect(x, gy + px * 1.05, 6, px * 1.95);
    }
    const signs = ['#e84a5f', '#2a9df4', '#f5a623', '#3aa76d', '#8e5ad8', '#ff7a45'];
    g.fillStyle = signs[k];
    g.fillRect(0, gy + px * 0.35, 512, px * 0.55);
    g.fillStyle = '#ffffff';
    g.font = `800 ${px * 0.4}px 'Hiragino Maru Gothic ProN', system-ui`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(['マーケット', 'カフェ', 'クリーニング', 'ほんや', 'ドラッグ', 'パン'][k], 256, gy + px * 0.63);
    const soot = g.createLinearGradient(0, 560, 0, 768);
    soot.addColorStop(0, 'rgb(0 0 0 / 0)');
    soot.addColorStop(1, 'rgb(0 0 0 / 0.25)');
    g.fillStyle = soot;
    g.fillRect(0, 560, 512, 208);
  });
}

/** 空。上は濃い青、地平線は白っぽく、薄い雲を散らす */
export const sky = () =>
  paint('sky', 1024, 512, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#4f9fe8');
    grad.addColorStop(0.55, '#9fd0f5');
    grad.addColorStop(1, '#e8f5ff');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 26; i++) {
      const x = r() * 1024;
      const y = 60 + r() * 260;
      const s = 30 + r() * 70;
      for (let k = 0; k < 6; k++) {
        g.fillStyle = `rgb(255 255 255 / ${0.18 + r() * 0.2})`;
        g.beginPath();
        g.ellipse(
          x + (r() - 0.5) * s * 2,
          y + (r() - 0.5) * s * 0.4,
          s * (0.6 + r()),
          s * (0.25 + r() * 0.2),
          0,
          0,
          Math.PI * 2
        );
        g.fill();
      }
    }
  });

/** 見切れる部分の repeat を、テクスチャ 1 枚の大きさ（m）から出す */
export function sized(t: THREE.CanvasTexture, key: string, w: number, h: number, tileW: number, tileH: number) {
  const k = `${key}:${w}:${h}`;
  let c = made.get(k);
  if (!c) {
    c = t.clone();
    c.repeat.set(w / tileW, h / tileH);
    c.needsUpdate = true;
    made.set(k, c);
  }
  return c;
}
