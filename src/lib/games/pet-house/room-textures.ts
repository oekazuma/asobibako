import type * as THREE from 'three';
import type { RoomTheme } from './decor';
import { canvas, grain, mottle, once, plaster, seeded, texture } from './textures';

/**
 * 模様替えの壁紙・床・ラグ・窓の外の絵。textures.ts と同じく canvas で描き、1 度描いたものを使い回す。
 * 同じ関数でもテーマごとに別の絵なので、once のキーには必ずテーマを入れる
 */

type Draw = (g: CanvasRenderingContext2D, rnd: () => number) => void;

function make(key: string, w: number, h: number, seed: number, draw: Draw, color = true, repeat = true) {
  return once(key, () => {
    const rnd = seeded(seed);
    return texture(
      canvas(w, h, (g) => draw(g, rnd)),
      color,
      repeat
    );
  });
}

/** ハート。(x, y) は上のくぼみ、s は幅の半分 */
export function heartPath(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y - s * 0.25, x - s, y - s * 0.25, x - s, y + s * 0.3);
  g.bezierCurveTo(x - s, y + s * 0.8, x - s * 0.2, y + s * 1.1, x, y + s * 1.5);
  g.bezierCurveTo(x + s * 0.2, y + s * 1.1, x + s, y + s * 0.8, x + s, y + s * 0.3);
  g.bezierCurveTo(x + s, y - s * 0.25, x, y - s * 0.25, x, y + s * 0.3);
  g.closePath();
}

/** 1 枚の絵の中で四方へはみ出した形を反対側にも描き、繰り返したときに継ぎ目で切れないようにする */
function wrapped(S: number, x: number, y: number, draw: (x: number, y: number) => void) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy);
}

/**
 * 壁紙。1 枚が壁の tile メートル四方。
 * ピンクは淡いストライプに白の水玉と濃いピンクの小さなハート、わしつは砂壁、ほくおうは白い塗り壁、おしろは深紅に金のダマスク
 */
export function wallpaper(theme: RoomTheme): { map: THREE.Texture; tile: number } {
  if (theme === 'pink')
    return {
      tile: 0.5,
      map: make('wall:pink', 512, 512, 43, (g, rnd) => {
        g.fillStyle = '#f9cfdc';
        g.fillRect(0, 0, 512, 512);
        for (let x = 0; x < 512; x += 64) {
          g.fillStyle = '#fbdbe5';
          g.fillRect(x, 0, 32, 512);
          g.fillStyle = 'rgb(255 255 255 / 0.55)';
          g.fillRect(x + 31, 0, 2, 512);
        }
        mottle(g, 512, 512, rnd, '#d9a3b4', '#ffffff', 0.35);
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const x = i * 128 + (j % 2) * 64 + 32;
            const y = j * 128 + 40;
            g.fillStyle = '#ffffff';
            wrapped(512, x, y, (px, py) => {
              g.beginPath();
              g.arc(px, py, 9, 0, Math.PI * 2);
              g.fill();
            });
            g.fillStyle = (i + j) % 2 ? '#ec6f9c' : '#f58bb2';
            wrapped(512, x + 64, y + 64, (px, py) => {
              heartPath(g, px, py - 20, 22);
              g.fill();
            });
            g.fillStyle = 'rgb(255 255 255 / 0.6)';
            wrapped(512, x + 56, y + 56, (px, py) => {
              g.beginPath();
              g.ellipse(px, py, 6, 4, -0.6, 0, Math.PI * 2);
              g.fill();
            });
          }
        grain(g, 512, 512, rnd, 8);
      })
    };
  if (theme === 'wafu')
    return {
      tile: 1,
      map: make('wall:wafu', 512, 512, 47, (g, rnd) => {
        g.fillStyle = '#d9c7a0';
        g.fillRect(0, 0, 512, 512);
        mottle(g, 512, 512, rnd, '#b39a6c', '#efe2c4', 0.8);
        for (let i = 0; i < 9000; i++) {
          const v = rnd();
          g.fillStyle = v < 0.5 ? 'rgb(120 90 50 / 0.35)' : v < 0.8 ? 'rgb(255 245 220 / 0.5)' : 'rgb(90 70 40 / 0.5)';
          g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
        }
        grain(g, 512, 512, rnd, 14);
      })
    };
  if (theme === 'castle')
    return {
      tile: 0.6,
      map: make('wall:castle', 512, 512, 53, (g, rnd) => {
        g.fillStyle = '#6f1a28';
        g.fillRect(0, 0, 512, 512);
        mottle(g, 512, 512, rnd, '#4a0f1a', '#8e2a3a', 0.6);
        const motif = (x: number, y: number) => {
          g.save();
          g.translate(x, y);
          for (const s of [-1, 1]) {
            g.save();
            g.scale(s, 1);
            g.beginPath();
            g.moveTo(0, -110);
            g.bezierCurveTo(40, -80, 70, -40, 30, -10);
            g.bezierCurveTo(70, 10, 80, 60, 30, 70);
            g.bezierCurveTo(50, 95, 20, 115, 0, 120);
            g.bezierCurveTo(12, 90, 8, 70, 0, 60);
            g.bezierCurveTo(30, 40, 30, 10, 0, 0);
            g.bezierCurveTo(20, -30, 20, -70, 0, -110);
            g.fill();
            g.beginPath();
            g.arc(55, -60, 9, 0, Math.PI * 2);
            g.arc(62, 30, 7, 0, Math.PI * 2);
            g.fill();
            g.restore();
          }
          g.restore();
        };
        g.fillStyle = 'rgb(214 170 90 / 0.8)';
        wrapped(512, 128, 128, motif);
        wrapped(512, 384, 384, motif);
        g.fillStyle = 'rgb(214 170 90 / 0.45)';
        for (const [x, y] of [
          [384, 128],
          [128, 384]
        ])
          wrapped(512, x, y, (px, py) => {
            g.beginPath();
            g.moveTo(px, py - 26);
            g.lineTo(px + 18, py);
            g.lineTo(px, py + 26);
            g.lineTo(px - 18, py);
            g.fill();
          });
        grain(g, 512, 512, rnd, 12);
      })
    };
  // ほくおうとナチュラルは白い漆喰。色は material の color で付ける
  return { tile: 1.2, map: plaster() };
}

/** 腰板。縦の板を並べた白（ピンク）・焦げ茶の框組み（おしろ）・白木（わしつ） */
export function wainscot(theme: RoomTheme): THREE.Texture {
  return make(`dado:${theme}`, 512, 256, 59, (g, rnd) => {
    if (theme === 'castle') {
      g.fillStyle = '#4a2c1c';
      g.fillRect(0, 0, 512, 256);
      grain(g, 512, 256, rnd, 30, 1);
      for (const x of [16, 272]) {
        g.fillStyle = 'rgb(0 0 0 / 0.35)';
        g.fillRect(x, 30, 224, 196);
        g.fillStyle = '#5c3824';
        g.fillRect(x + 6, 36, 212, 184);
        g.fillStyle = 'rgb(255 220 170 / 0.18)';
        g.fillRect(x + 6, 36, 212, 4);
        g.fillRect(x + 6, 36, 4, 184);
        g.strokeStyle = 'rgb(220 170 90 / 0.55)';
        g.lineWidth = 3;
        g.strokeRect(x + 22, 52, 180, 152);
      }
      return;
    }
    const pink = theme === 'pink';
    g.fillStyle = pink ? '#fff7f8' : '#d7b88c';
    g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 32) {
      g.fillStyle = pink ? 'rgb(200 150 165 / 0.35)' : 'rgb(90 60 30 / 0.4)';
      g.fillRect(x, 0, 2, 256);
      g.fillStyle = 'rgb(255 255 255 / 0.5)';
      g.fillRect(x + 2, 0, 2, 256);
    }
    if (!pink) grain(g, 512, 256, rnd, 24, 256);
    else grain(g, 512, 256, rnd, 5);
  });
}

/** 床の絵と 1 枚の大きさ（メートル）。ナチュラルとほくおうの板張りは textures.ts の planks で描く */
export function floorMap(theme: 'pink' | 'wafu' | 'castle'): { map: THREE.Texture; tile: number } {
  if (theme === 'pink') return { tile: 1.2, map: chevron() };
  if (theme === 'wafu') return { tile: 3.6, map: tatami() };
  return { tile: 1, map: marble() };
}

/** 淡いピンクの木のヘリンボーン（矢羽根）。列ごとに斜めの向きを変えて V の字に並べる */
function chevron() {
  return make('floor:pink', 1024, 1024, 61, (g, rnd) => {
    const cols = 8;
    const W = 1024 / cols;
    const H = 1024 / 12;
    const tones = ['#f1d3cb', '#ecc9c0', '#f6ddd6', '#e8c3ba', '#f3d8d0'];
    for (let c = 0; c < cols; c++) {
      const s = c % 2 ? 1 : -1;
      for (let r = -2; r < 14; r++) {
        const x = c * W;
        const y = r * H;
        const lift = s > 0 ? 0 : W;
        g.fillStyle = tones[Math.floor(rnd() * tones.length)];
        g.beginPath();
        g.moveTo(x, y + lift);
        g.lineTo(x + W, y + W - lift);
        g.lineTo(x + W, y + W - lift + H);
        g.lineTo(x, y + lift + H);
        g.closePath();
        g.fill();
        for (let k = 0; k < 7; k++) {
          const o = rnd() * H;
          g.strokeStyle = `rgb(170 110 100 / ${0.05 + rnd() * 0.08})`;
          g.lineWidth = 1 + rnd() * 1.5;
          g.beginPath();
          g.moveTo(x, y + lift + o);
          g.lineTo(x + W, y + W - lift + o);
          g.stroke();
        }
        g.strokeStyle = 'rgb(150 95 90 / 0.45)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    mottle(g, 1024, 1024, rnd, '#c79a90', '#ffffff', 0.25);
    grain(g, 1024, 1024, rnd, 10);
  });
}

/**
 * 3.6m 四方に 8 畳。上下の列に横向きを 2 枚ずつ、まん中に縦向きを 4 枚。
 * い草の目は畳の短い辺に平行に走り、畳ごとに色の焼け方を少し変える
 */
function tatami() {
  return make('floor:wafu', 1024, 1024, 67, (g, rnd) => {
    const u = 1024 / 4;
    const mats: [number, number, number, number][] = [
      [0, 0, 2, 1],
      [2, 0, 2, 1],
      [0, 1, 1, 2],
      [1, 1, 1, 2],
      [2, 1, 1, 2],
      [3, 1, 1, 2],
      [0, 3, 2, 1],
      [2, 3, 2, 1]
    ];
    const edge = 10;
    for (const [i, j, w, h] of mats) {
      const x = i * u;
      const y = j * u;
      const W = w * u;
      const H = h * u;
      const tone = 150 + rnd() * 20;
      g.fillStyle = `rgb(${tone + 30} ${tone + 32} ${tone - 45})`;
      g.fillRect(x, y, W, H);
      const across = W > H;
      for (let k = 0; k < (across ? W : H); k += 3) {
        g.fillStyle = k % 6 ? 'rgb(255 250 200 / 0.18)' : 'rgb(80 90 30 / 0.22)';
        if (across) g.fillRect(x + k, y, 1.5, H);
        else g.fillRect(x, y + k, W, 1.5);
      }
      // 縁は長い辺にだけ付ける
      g.fillStyle = '#2d3528';
      if (across) {
        g.fillRect(x, y, W, edge);
        g.fillRect(x, y + H - edge, W, edge);
      } else {
        g.fillRect(x, y, edge, H);
        g.fillRect(x + W - edge, y, edge, H);
      }
      g.strokeStyle = 'rgb(40 35 20 / 0.6)';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, W - 2, H - 2);
    }
    mottle(g, 1024, 1024, rnd, '#8a8a40', '#fff8c8', 0.4);
    grain(g, 1024, 1024, rnd, 12);
  });
}

/** クリーム色と深緑の大理石の市松。1 枚の絵に 0.5m のタイルが 2×2 */
function marble() {
  return make('floor:castle', 1024, 1024, 71, (g, rnd) => {
    const t = 512;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const dark = (i + j) % 2 === 1;
        const x = i * t;
        const y = j * t;
        g.save();
        g.beginPath();
        g.rect(x, y, t, t);
        g.clip();
        g.fillStyle = dark ? '#2f3b36' : '#ece3d2';
        g.fillRect(x, y, t, t);
        const tile = canvas(t, t, (m) =>
          mottle(m, t, t, rnd, dark ? '#16201c' : '#c9bca4', dark ? '#4d5f57' : '#ffffff')
        );
        g.drawImage(tile, x, y);
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = dark
            ? `rgb(200 210 200 / ${0.15 + rnd() * 0.25})`
            : `rgb(120 105 90 / ${0.15 + rnd() * 0.3})`;
          g.lineWidth = 0.8 + rnd() * 2;
          g.beginPath();
          let px = x + rnd() * t;
          let py = y;
          g.moveTo(px, py);
          while (py < y + t) {
            px += (rnd() - 0.5) * 60;
            py += 20 + rnd() * 40;
            g.lineTo(px, py);
          }
          g.stroke();
        }
        g.restore();
        g.fillStyle = 'rgb(60 50 40 / 0.5)';
        g.fillRect(x, y, t, 2);
        g.fillRect(x, y, 2, t);
      }
    grain(g, 1024, 1024, rnd, 6);
  });
}

/** 毛足の長いピンクのラグ。明るい毛先と影の根元の点を細かく散らす */
export function shag() {
  return make('rug:pink', 512, 512, 73, (g, rnd) => {
    g.fillStyle = '#f28fb3';
    g.fillRect(0, 0, 512, 512);
    mottle(g, 512, 512, rnd, '#d45f8a', '#ffd0e0', 0.7);
    for (let i = 0; i < 30000; i++) {
      const v = rnd();
      g.strokeStyle = v < 0.4 ? 'rgb(190 70 115 / 0.45)' : 'rgb(255 215 230 / 0.6)';
      g.lineWidth = 1 + rnd();
      const x = rnd() * 512;
      const y = rnd() * 512;
      const a = rnd() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      g.stroke();
    }
  });
}

/** 模様のラグ。わしつは藍の青海波、ほくおうは生成りに黒い細いひし形、おしろは深紅に金の縁とメダリオン */
export function patternRug(theme: 'wafu' | 'nordic' | 'castle') {
  return make(
    `rug:${theme}`,
    768,
    1024,
    79,
    (g, rnd) => {
      const W = 768;
      const H = 1024;
      if (theme === 'wafu') {
        g.fillStyle = '#f0e6d0';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#233a66';
        g.fillRect(30, 30, W - 60, H - 60);
        g.save();
        g.beginPath();
        g.rect(30, 30, W - 60, H - 60);
        g.clip();
        const r = 42;
        for (let row = 0, y = 20; y < H + r; row++, y += r / 2)
          for (let x = (row % 2) * r - r; x < W + r; x += r * 2)
            for (let k = 4; k >= 1; k--) {
              g.fillStyle = k % 2 ? '#233a66' : '#3f5f95';
              g.beginPath();
              g.arc(x, y, (r * k) / 4, Math.PI, 0);
              g.fill();
              g.strokeStyle = '#d9e2f0';
              g.lineWidth = 2.2;
              g.stroke();
            }
        g.restore();
      } else if (theme === 'nordic') {
        g.fillStyle = '#efe8da';
        g.fillRect(0, 0, W, H);
        mottle(g, W, H, rnd, '#cfc3ab', '#ffffff', 0.5);
        g.strokeStyle = 'rgb(45 42 40 / 0.8)';
        g.lineWidth = 3;
        const cw = 128;
        const ch = 170;
        for (let y = -ch; y < H + ch; y += ch)
          for (let x = 0; x < W + cw; x += cw) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + cw / 2 + (rnd() - 0.5) * 8, y + ch / 2);
            g.lineTo(x, y + ch);
            g.lineTo(x - cw / 2 + (rnd() - 0.5) * 8, y + ch / 2);
            g.closePath();
            g.stroke();
          }
        for (let i = 0; i < 20000; i++) {
          g.fillStyle = rnd() < 0.5 ? 'rgb(255 255 255 / 0.5)' : 'rgb(150 130 100 / 0.25)';
          g.fillRect(rnd() * W, rnd() * H, 2, 2);
        }
      } else {
        g.fillStyle = '#8a1624';
        g.fillRect(0, 0, W, H);
        mottle(g, W, H, rnd, '#5c0c16', '#b02a3a', 0.6);
        const gold = '#d8ac52';
        const navy = '#1f2a4d';
        g.strokeStyle = gold;
        for (const [m, lw] of [
          [18, 10],
          [70, 6],
          [84, 3]
        ]) {
          g.lineWidth = lw;
          g.strokeRect(m, m, W - m * 2, H - m * 2);
        }
        g.fillStyle = navy;
        g.fillRect(30, 30, W - 60, 34);
        g.fillRect(30, H - 64, W - 60, 34);
        g.fillRect(30, 30, 34, H - 60);
        g.fillRect(W - 64, 30, 34, H - 60);
        g.fillStyle = gold;
        for (let x = 50; x < W - 40; x += 34) {
          g.beginPath();
          g.arc(x, 47, 7, 0, Math.PI * 2);
          g.arc(x, H - 47, 7, 0, Math.PI * 2);
          g.fill();
        }
        for (let y = 50; y < H - 40; y += 34) {
          g.beginPath();
          g.arc(47, y, 7, 0, Math.PI * 2);
          g.arc(W - 47, y, 7, 0, Math.PI * 2);
          g.fill();
        }
        const cx = W / 2;
        const cy = H / 2;
        for (const [rx, ry, c] of [
          [160, 210, gold],
          [146, 194, navy],
          [104, 140, '#8a1624'],
          [84, 112, gold],
          [66, 88, '#f0e2c0'],
          [42, 56, navy],
          [21, 28, gold]
        ] as const) {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(cx, cy - ry);
          g.quadraticCurveTo(cx + rx * 0.3, cy - ry * 0.3, cx + rx, cy);
          g.quadraticCurveTo(cx + rx * 0.3, cy + ry * 0.3, cx, cy + ry);
          g.quadraticCurveTo(cx - rx * 0.3, cy + ry * 0.3, cx - rx, cy);
          g.quadraticCurveTo(cx - rx * 0.3, cy - ry * 0.3, cx, cy - ry);
          g.fill();
        }
        for (const [x, y, sx, sy] of [
          [100, 100, 1, 1],
          [W - 100, 100, -1, 1],
          [100, H - 100, 1, -1],
          [W - 100, H - 100, -1, -1]
        ]) {
          g.fillStyle = gold;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + sx * 90, y);
          g.quadraticCurveTo(x + sx * 28, y + sy * 28, x, y + sy * 90);
          g.closePath();
          g.fill();
        }
      }
      for (let y = 0; y < H; y += 3) {
        g.fillStyle = `rgb(0 0 0 / ${0.04 + rnd() * 0.05})`;
        g.fillRect(0, y, W, 1);
      }
      grain(g, W, H, rnd, 18);
    },
    true,
    false
  );
}

/** 窓の外。明るく飛ばし気味にして、部屋の中との明るさの差を出す */
export function outside(theme: RoomTheme) {
  return make(`view:${theme}`, 512, 512, 83, (g, rnd) => VIEWS[theme](g, rnd), true, false);
}

const hills = (g: CanvasRenderingContext2D, color: string, y: number, amp: number, seed: number) => {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 512);
  for (let x = 0; x <= 512; x += 16)
    g.lineTo(x, y + Math.sin(x / 70 + seed) * amp + Math.sin(x / 23 + seed * 2) * amp * 0.3);
  g.lineTo(512, 512);
  g.fill();
};

const cloud = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.beginPath();
  for (const [dx, dy, r] of [
    [0, 0, 1],
    [0.9, 0.15, 0.75],
    [-0.9, 0.2, 0.7],
    [0.4, -0.45, 0.8],
    [-0.4, -0.3, 0.7]
  ])
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
  g.fill();
};

const VIEWS: Record<RoomTheme, Draw> = {
  natural(g) {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#cfe6f6');
    sky.addColorStop(1, '#f4f9fb');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#b9d7a4';
    for (const [x, y, r] of [
      [60, 250, 110],
      [280, 210, 132],
      [480, 260, 104]
    ]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d6e9c4';
    g.fillRect(0, 390, 512, 122);
    g.fillStyle = '#ffffff';
    for (let x = 8; x < 512; x += 44) g.fillRect(x, 344, 20, 120);
    g.fillRect(0, 372, 512, 12);
    g.fillRect(0, 428, 512, 12);
  },
  pink(g, rnd) {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#c9d8ff');
    sky.addColorStop(0.45, '#f6d6f2');
    sky.addColorStop(1, '#ffe4ec');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    const bands = ['#ffb3c7', '#ffd2a8', '#fff2a8', '#c8f0c0', '#bfe0ff', '#d9c6ff'];
    g.lineWidth = 14;
    bands.forEach((c, i) => {
      g.strokeStyle = c;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(256, 470, 300 - i * 14, Math.PI, 0);
      g.stroke();
    });
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    cloud(g, 90, 330, 46);
    cloud(g, 420, 320, 52);
    cloud(g, 300, 120, 30);
    g.fillStyle = 'rgb(255 255 255 / 0.9)';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 512;
      const y = rnd() * 260;
      const s = 3 + rnd() * 4;
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const r = k % 2 ? s * 0.4 : s;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.fill();
    }
    hills(g, '#f3c1d6', 420, 18, 1);
    hills(g, '#fbd9e6', 455, 12, 3);
  },
  wafu(g, rnd) {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#c9d2dc');
    sky.addColorStop(1, '#eef1f4');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    hills(g, '#dde3ea', 250, 30, 2);
    // 雪をかぶった松
    for (const [x, y, s] of [
      [90, 300, 1.2],
      [430, 280, 1]
    ]) {
      g.fillStyle = '#4a3a2c';
      g.fillRect(x - 8 * s, y, 16 * s, 160);
      for (let k = 0; k < 4; k++) {
        const yy = y - 30 + k * 45 * s;
        const w = (70 + k * 25) * s;
        g.fillStyle = '#2f4a3a';
        g.beginPath();
        g.ellipse(x, yy, w, 26 * s, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(x, yy - 12 * s, w * 0.95, 16 * s, 0, Math.PI, 0);
        g.fill();
      }
    }
    // 石灯籠
    g.fillStyle = '#8f8e8a';
    g.fillRect(246, 330, 20, 90);
    g.fillRect(226, 300, 60, 34);
    g.fillStyle = '#ffe9a8';
    g.fillRect(240, 308, 32, 20);
    g.fillStyle = '#8f8e8a';
    g.beginPath();
    g.moveTo(206, 302);
    g.lineTo(306, 302);
    g.lineTo(256, 262);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(212, 296);
    g.lineTo(300, 296);
    g.lineTo(256, 262);
    g.fill();
    g.fillStyle = '#f7f9fb';
    g.fillRect(0, 420, 512, 92);
    g.fillStyle = 'rgb(255 255 255 / 0.95)';
    for (let i = 0; i < 160; i++) {
      g.beginPath();
      g.arc(rnd() * 512, rnd() * 512, 1.5 + rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  },
  nordic(g, rnd) {
    const sky = g.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#a9c9e2');
    sky.addColorStop(1, '#eaf2f6');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgb(255 255 255 / 0.8)';
    cloud(g, 140, 90, 26);
    cloud(g, 400, 130, 20);
    g.fillStyle = '#7f95a8';
    g.beginPath();
    g.moveTo(0, 290);
    g.lineTo(80, 200);
    g.lineTo(150, 250);
    g.lineTo(230, 180);
    g.lineTo(330, 270);
    g.lineTo(512, 240);
    g.lineTo(512, 300);
    g.lineTo(0, 300);
    g.fill();
    g.fillStyle = '#f4f7fa';
    g.beginPath();
    g.moveTo(62, 220);
    g.lineTo(80, 200);
    g.lineTo(100, 215);
    g.moveTo(205, 202);
    g.lineTo(230, 180);
    g.lineTo(255, 202);
    g.fill();
    const sea = g.createLinearGradient(0, 290, 0, 512);
    sea.addColorStop(0, '#5d8fb3');
    sea.addColorStop(1, '#2f5e86');
    g.fillStyle = sea;
    g.fillRect(0, 290, 512, 222);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgb(255 255 255 / ${0.25 + rnd() * 0.4})`;
      g.fillRect(rnd() * 512, 300 + rnd() * 200, 10 + rnd() * 30, 2);
    }
    // 帆かけ舟
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(330, 330);
    g.lineTo(330, 270);
    g.lineTo(365, 330);
    g.fill();
    g.fillStyle = '#b04a3a';
    g.fillRect(318, 330, 54, 8);
    g.fillStyle = '#d8c7a8';
    g.fillRect(0, 440, 512, 72);
  },
  castle(g, rnd) {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#0e1638');
    sky.addColorStop(0.7, '#2b3a78');
    sky.addColorStop(1, '#4b4f8e');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgb(255 250 230 / ${0.4 + rnd() * 0.6})`;
      const s = rnd() < 0.1 ? 3 : 1.5;
      g.fillRect(rnd() * 512, rnd() * 380, s, s);
    }
    const glow = g.createRadialGradient(380, 120, 20, 380, 120, 110);
    glow.addColorStop(0, 'rgb(255 245 200 / 0.5)');
    glow.addColorStop(1, 'rgb(255 245 200 / 0)');
    g.fillStyle = glow;
    g.fillRect(250, 0, 262, 260);
    g.fillStyle = '#fff4cf';
    g.beginPath();
    g.arc(380, 120, 42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgb(230 215 170 / 0.5)';
    g.beginPath();
    g.arc(368, 110, 8, 0, Math.PI * 2);
    g.arc(392, 132, 6, 0, Math.PI * 2);
    g.fill();
    // 遠くの塔の影と、灯りのともる窓
    g.fillStyle = '#1a1f40';
    for (const [x, w, h] of [
      [40, 50, 200],
      [100, 90, 140],
      [190, 40, 230]
    ]) {
      g.fillRect(x, 512 - h, w, h);
      g.beginPath();
      g.moveTo(x - 8, 512 - h);
      g.lineTo(x + w / 2, 512 - h - w);
      g.lineTo(x + w + 8, 512 - h);
      g.fill();
    }
    g.fillStyle = '#ffd98a';
    for (const [x, y] of [
      [58, 360],
      [70, 420],
      [130, 400],
      [200, 330]
    ])
      g.fillRect(x, y, 8, 14);
    hills(g, '#141a36', 450, 14, 5);
  }
};

/** 白いレースのカーテン。穴は透明にして alphaTest で抜く（半透明にすると窓の絵や日だまりと重なり順が狂う） */
export function lace() {
  return make('lace', 256, 256, 89, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < 256; y += 32)
      for (let x = (y / 32) % 2 ? 16 : 0; x < 256 + 16; x += 32) {
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          g.moveTo(x, y);
          g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 2.6, a, 0, Math.PI * 2);
        }
        g.fill();
        g.beginPath();
        g.arc(x + 16, y + 16, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    for (let x = 0; x < 256; x += 8) {
      g.fillRect(x, 0, 3, 256);
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/** 障子紙。和紙の繊維をうすく散らす */
export function shojiPaper() {
  return make('shoji', 256, 256, 97, (g, rnd) => {
    g.fillStyle = '#fbf6ea';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) {
      g.strokeStyle = `rgb(200 185 150 / ${0.1 + rnd() * 0.2})`;
      g.lineWidth = 0.6;
      const x = rnd() * 256;
      const y = rnd() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(
        x + (rnd() - 0.5) * 20,
        y + (rnd() - 0.5) * 20,
        x + (rnd() - 0.5) * 30,
        y + (rnd() - 0.5) * 30
      );
      g.stroke();
    }
  });
}

/** 水玉の布。ピンクの小物のクッション */
export function dots(base: string, dot: string) {
  return make(`dots:${base}:${dot}`, 128, 128, 101, (g, rnd) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = dot;
    for (const [x, y] of [
      [32, 32],
      [96, 96],
      [96, 32],
      [32, 96]
    ].slice(0, 2)) {
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, 128, 128, rnd, 10);
  });
}
