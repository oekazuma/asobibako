import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { layAtlas } from '../atlas';
import { buildDoll } from '../doll';
import { makeDoll } from '../doll3d';
import type { Me } from '../net';
import { eyeType, placeRoot, type World } from '../world3d';
import { Senses3d, standout } from './senses3d';

// 塗りの描き先と模様は GPU と canvas に作るので、ここでは何もしない描画器と模様で足りる
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
vi.mock('../textures', async (orig) => ({
  ...(await orig<typeof import('../textures')>()),
  rainbowMottle: () => undefined
}));

/** 1 画素 = [r, g, b, a] を並べた絵 */
const img = (...px: number[][]) => new Uint8Array(px.flat());

describe('standout', () => {
  it('体の画素（少しでも違う画素）のうち、diff より違う画素の割合を返す', () => {
    const bg = [100, 100, 100, 255];
    const without = img(bg, bg, bg, bg, bg, bg);
    // 体の画素は 4 つ（差 1・20・40・200）、まわりは同じ
    const withBody = img([101, 100, 100, 255], [120, 100, 100, 255], [100, 60, 100, 255], [100, 100, 255, 255], bg, bg);
    expect(standout(withBody, without, 0.12)).toBe(2 / 4);
    expect(standout(withBody, without, 0.5)).toBe(1 / 4);
    expect(standout(withBody, without, 0.001)).toBe(1);
  });

  it('体の画素がほとんど無ければ 0', () => {
    const bg = [0, 0, 0, 255];
    expect(standout(img([255, 255, 255, 255], [255, 0, 0, 255], bg), img(bg, bg, bg), 0.12)).toBe(0);
  });
});

describe('eyeType', () => {
  it('半精度の浮動小数に描ける端末では丸めずに描き、描けない端末では 8 bit に描く', () => {
    const only =
      (...names: string[]) =>
      (name: string) =>
        names.includes(name);
    expect(eyeType(only('EXT_color_buffer_float'))).toBe(THREE.HalfFloatType);
    expect(eyeType(only('EXT_color_buffer_half_float'))).toBe(THREE.HalfFloatType);
    expect(eyeType(only())).toBe(THREE.UnsignedByteType);
  });
});

describe('Senses3d の体の表面', () => {
  const surface = buildDoll(0.02);
  const atlas = layAtlas(surface.pos, surface.idx, 2048);
  const wall: Me = {
    ms: 0,
    pos: [0, 1, 4.9],
    yaw: Math.PI,
    cling: { kind: 'wall', nx: 0, nz: -1 },
    pose: 'stand',
    crouch: false,
    paint: false,
    look: [0, 0],
    eye: null
  };

  it('3D の体が渡した大きさで置かれていれば点を返し、前の大きさのままなら null（床の体は位置だけでは見分けられない）', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const world = { renderedAt: Infinity } as unknown as World;
    const eye = new Senses3d(world, () => rig);
    placeRoot(rig.root, { ...wall, scale: 0.5 });
    expect(eye.surface(2, wall, 0.5)?.length).toBeGreaterThan(100);
    expect(eye.surface(2, wall, 1)).toBeNull();
    const floor: Me = { ...wall, pos: [0, 0, 0], cling: null };
    placeRoot(rig.root, floor);
    expect(eye.surface(2, floor, 1)?.length).toBeGreaterThan(100);
    expect(eye.surface(2, floor, 0.5)).toBeNull();
    placeRoot(rig.root, { ...floor, scale: 0.5 });
    const top = Math.max(...eye.surface(2, floor, 0.5)!.map((p) => p.world[1]));
    expect(top).toBeGreaterThan(0.5);
    expect(top).toBeLessThan(0.62);
  });
});
