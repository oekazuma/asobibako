import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Built } from '../world3d';

/**
 * node には canvas が無いので、描く命令を捨てて空の画素を返す 2D の文脈を渡す。
 * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数を見る
 */
function fakeCanvas() {
  const canvas = { width: 0, height: 0, getContext: () => context };
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
      set: () => true
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

function meshes(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  built.group.traverse((o) => {
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
