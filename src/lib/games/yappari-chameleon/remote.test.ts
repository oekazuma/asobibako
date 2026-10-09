import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll } from './doll3d';
import { packDabs, type Me } from './net';
import type { Dab } from './paint';
import { paintColors, Remote, type Show } from './remote';

// 塗りの描き先と模様は GPU と canvas に作るので、ここでは何もしない描画器と模様で足りる
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
vi.mock('./textures', async (orig) => ({
  ...(await orig<typeof import('./textures')>()),
  rainbowMottle: () => undefined
}));

const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

const me = (ms: number, x: number, extra: Partial<Me> = {}): Me => ({
  ms,
  pos: [x, 0, 0],
  yaw: 0,
  cling: null,
  pose: 'stand',
  crouch: false,
  paint: false,
  look: [0, 0],
  ...extra
});
const show = (extra: Partial<Show> = {}): Show => ({ pin: null, visible: true, armed: false, shine: null, ...extra });
const dab = (i: number): Dab => ({ p: [i / 100, 1, 0], n: [0, 0, 1], r: 0.05, c: [0, 1, 0], a: 0.3, m: 0, ro: 0.8 });

function remote() {
  const rig = makeDoll(renderer, surface, atlas);
  vi.spyOn(rig.paint, 'apply').mockImplementation(() => {});
  vi.spyOn(rig.paint, 'rebuild').mockImplementation(() => {});
  vi.spyOn(rig.paint, 'flush').mockImplementation(() => {});
  return new Remote(rig, new THREE.Scene());
}

describe('Remote', () => {
  it('届いた動きを 0.1 秒遅らせてつなぎ、まだ何も届いていなければ描かない', () => {
    const r = remote();
    r.update(1 / 60, 0, show());
    expect(r.rig.root.visible).toBe(false);
    r.push(me(0, 0), 1000);
    r.push(me(50, 1), 1050);
    r.update(1 / 60, 1125, show());
    expect(r.rig.root.visible).toBe(true);
    expect(r.rig.root.position.x).toBeCloseTo(0.5);
  });

  it('答え合わせでは撃たれたときの体に戻し、見せないときは描かない', () => {
    const r = remote();
    r.push(me(0, 4), 0);
    r.update(1 / 60, 500, show({ pin: me(0, -2) }));
    expect(r.rig.root.position.x).toBeCloseTo(-2);
    r.update(1 / 60, 500, show({ visible: false }));
    expect(r.rig.root.visible).toBe(false);
  });

  it('吹き付けは足すだけなら足し、縮んだら列から塗り直す', () => {
    const r = remote();
    r.dabs(0, packDabs([dab(0), dab(1)]));
    expect(r.rig.paint.apply).toHaveBeenCalledTimes(1);
    r.dabs(1, packDabs([dab(5)]));
    expect(r.rig.paint.rebuild).toHaveBeenCalledTimes(1);
    expect(r.log).toHaveLength(2);
  });

  it('銃は構えたハンターだけが、絵筆はペイント中の隠れる側だけが持つ', () => {
    const r = remote();
    const held = () => r.rig.bones['forearm.r'].children.filter((o) => o.visible).length;
    r.push(me(0, 0, { paint: true }), 0);
    r.update(1 / 60, 500, show());
    expect(held()).toBe(1);
    r.update(1 / 60, 500, show({ armed: true }));
    expect(held()).toBe(1);
    r.update(1 / 60, 500, show({ armed: false, visible: true, pin: me(0, 0) }));
    expect(held()).toBe(0);
  });
});

describe('paintColors', () => {
  it('塗った量が少なければ破片の多くは白く、塗りの色を混ぜる', () => {
    expect(paintColors([])).toEqual(Array(20).fill([1, 1, 1]));
    const some = paintColors(Array.from({ length: 1000 }, (_, i) => dab(i)));
    expect(some.filter((c) => c[1] === 1 && c[0] === 0)).toHaveLength(10);
  });
});
