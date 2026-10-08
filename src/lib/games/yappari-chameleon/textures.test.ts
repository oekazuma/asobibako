import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { finish, readPick, type Pattern } from './textures';

/** 上の行が赤、下の行が青の 1 × 2 の絵 */
function twoRows(): Pattern {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  return { canvas: {} as HTMLCanvasElement, image: { width: 1, height: 2, data } as ImageData, meters: [1, 1] };
}

describe('readPick', () => {
  it('絵の上のほう（v が大きい側）では上の行の色を返す', () => {
    const m = finish({ pattern: twoRows() }, [1, 1]);
    m.map = new THREE.Texture();
    expect(readPick(m, new THREE.Vector2(0.5, 0.9))?.color).toEqual([1, 0, 0]);
    expect(readPick(m, new THREE.Vector2(0.5, 0.1))?.color).toEqual([0, 0, 1]);
  });
});
