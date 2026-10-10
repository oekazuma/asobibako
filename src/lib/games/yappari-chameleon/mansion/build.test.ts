import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pattern } from '../textures';
import type { Built } from '../world3d';

/**
 * node には canvas が無いので、描く命令を捨てて空の画素を返す 2D の文脈を渡す。
 * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数と、線の太さ（lineWidth に入れた値）を見る
 */
function fakeCanvas() {
  const canvas = { width: 0, height: 0, widths: [] as number[], getContext: () => context };
  const context: object = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'canvas') return canvas;
        if (key === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4)
          });
        if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
        return () => {};
      },
      set: (_, key, value) => {
        if (key === 'lineWidth') canvas.widths.push(value);
        return true;
      }
    }
  );
  return canvas;
}

let built: Built;
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: fakeCanvas });
  const { buildMansion } = await import('./build');
  built = buildMansion();
});

function meshes(root: THREE.Object3D = built.group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}
const materials = () => meshes().flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));

describe('組み立てた屋敷', () => {
  it('どの材質も透かし窓の効く MeshStandardMaterial で、透けず、スポイトの印を持つ', () => {
    for (const m of materials()) {
      expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
      // 透ける材質は mergeStatic がまとめず、描く回数が増える
      expect(m.transparent).toBe(false);
      expect(m.userData.pick, (m as THREE.MeshStandardMaterial).color.getHexString()).toBeDefined();
    }
  });

  it('まとめたあとの Mesh の数と模様の画素の量が上限を超えない', () => {
    // 1 枚の Mesh は画面と日の影で 2 回ほど描くので、描く回数の上限（1354 回）の 3 分の 1 を Mesh の上限にする
    expect(meshes().length).toBeLessThanOrEqual(450);
    const canvases = new Set(
      materials()
        .map((m) => (m as THREE.MeshStandardMaterial).map?.image as { width: number; height: number } | undefined)
        .filter((c) => !!c)
    );
    const bytes = [...canvases].reduce((n, c) => n + c!.width * c!.height * 4, 0);
    expect(bytes).toBeLessThanOrEqual(32e6);
  });
});

/** 模様の中でいちばん細い線（m）。線を引かない模様は Infinity */
const thinnest = (p: Pattern) =>
  Math.min(...(p.canvas as unknown as { widths: number[] }).widths) * (p.meters[0] / p.canvas.width);

describe('作り込んだ模様', () => {
  it('線は 2cm 以上（体に写せる太さ）', async () => {
    const rooms = await import('../textures-rooms');
    for (const [name, p] of Object.entries({ whiteTile: rooms.whiteTile(), darkPlanks: rooms.darkPlanks() }))
      expect(thinnest(p), name).toBeGreaterThanOrEqual(0.0199);
  });

  it('六角タイルの目地は 2cm で、模様は周期の整数倍で継ぎ目なく繰り返す', async () => {
    const { blueHex, HEX } = await import('../textures-rooms');
    const p = blueHex();
    expect(HEX.grout).toBeGreaterThanOrEqual(0.02);
    expect(p.meters[0] / (Math.sqrt(3) * HEX.r)).toBeCloseTo(8, 6);
    expect(p.meters[1] / (3 * HEX.r)).toBeCloseTo(4, 6);
    expect(p.canvas.width / p.meters[0]).toBeCloseTo(p.canvas.height / p.meters[1], -1);
  });
});

describe('キッチンの肉の棚', () => {
  it('霜降りの肉の塊は下の 3 段に 2〜4 個ずつ、浮かず沈まずに棚板の上に載る', async () => {
    const { piece } = await import('./furniture');
    const rack = piece({ kind: 'meat-rack', at: [-20.75, 0, 10], turn: 1 });
    rack.updateMatrixWorld(true);
    // 棚の中で模様を持つのは霜降りの肉だけ
    const lumps = meshes(rack).filter((m) => !!(m.material as THREE.MeshStandardMaterial).map);
    const tops = [0.15, 0.7, 1.25].map((y) => y + 0.0125);
    const counts = tops.map(() => 0);
    for (const m of lumps) {
      const bottom = new THREE.Box3().setFromObject(m).min.y;
      const k = tops.findIndex((t) => Math.abs(bottom - t) < 0.01);
      expect(k, `${bottom}`).toBeGreaterThanOrEqual(0);
      counts[k]++;
    }
    for (const n of counts) expect(n >= 2 && n <= 4, `${counts}`).toBe(true);
  });
});

describe('ランドリーの洗濯ひも', () => {
  it('縄 1 本に形のある服を 5〜8 枚、洗濯ばさみ 2 つずつで留め、服の裾は人形の頭より上', async () => {
    const { piece } = await import('./furniture');
    const line = piece({ kind: 'clothesline', at: [-15, 2.3, -1.5], turn: 0, span: 9 });
    line.position.y = 2.3;
    line.updateMatrixWorld(true);
    const clothes = meshes(line).filter((m) => m.geometry instanceof THREE.ShapeGeometry);
    expect(clothes.length).toBeGreaterThanOrEqual(5);
    expect(clothes.length).toBeLessThanOrEqual(8);
    const pegs = meshes(line).filter(
      (m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === 'c9a54a'
    );
    expect(pegs).toHaveLength(clothes.length * 2);
    // 人形の背は 1.15m で、下を歩いても頭が服に重ならない
    for (const c of clothes) expect(new THREE.Box3().setFromObject(c).min.y).toBeGreaterThan(1.45);
  });
});
