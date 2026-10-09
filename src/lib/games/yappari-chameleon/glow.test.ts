import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll } from './doll3d';
import { Glow } from './glow';

const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

describe('Glow', () => {
  it('見えている体が印を付け、壁の奥の影は印のないところだけを描く', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const glow = new Glow(rig);
    expect(rig.material).toMatchObject({ stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp });
    const ghost = rig.root.children.find(
      (o): o is THREE.SkinnedMesh =>
        o instanceof THREE.SkinnedMesh && o.material !== rig.material && o.renderOrder === 20
    )!;
    expect(ghost.material).toMatchObject({
      stencilWrite: true,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilRef: 1,
      depthFunc: THREE.GreaterDepth
    });
    glow.set('red');
    expect(ghost.visible).toBe(true);
    glow.dispose();
  });
});
