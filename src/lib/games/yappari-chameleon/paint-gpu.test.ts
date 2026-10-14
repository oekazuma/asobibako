import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PaintSurface, scratchFor } from './paint-gpu';

/** 描き先を記録するだけの描画器。GPU が無くても、flush がどの描き先へ描いたかを見られる */
function recorder() {
  const drawn: unknown[] = [];
  const renderer = new Proxy(
    {},
    { get: (_, key) => (key === 'setRenderTarget' ? (t: unknown) => drawn.push(t) : () => null) }
  ) as unknown as THREE.WebGLRenderer;
  return { renderer, drawn };
}

describe('PaintSurface の作業用の描き先', () => {
  it('同じ描画器の 2 つの面は、すき間へ広げ直すときに同じ作業用の描き先へ描く', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const b = new PaintSurface(renderer, new THREE.BufferGeometry());
    const scratch = scratchFor(renderer);
    for (const s of [a, b]) {
      drawn.length = 0;
      s.apply([]);
      s.flush();
      expect(drawn).toContain(scratch.color);
      expect(drawn).toContain(scratch.gloss);
    }
    expect(scratchFor(renderer)).toBe(scratch);
  });

  it('描画器がちがえば、作業用の描き先も別に作る', () => {
    expect(scratchFor(recorder().renderer)).not.toBe(scratchFor(recorder().renderer));
  });

  it('面を捨てても、ほかの面が使う共有の作業用の描き先は捨てない', () => {
    const { renderer } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const scratch = scratchFor(renderer);
    const color = vi.spyOn(scratch.color, 'dispose');
    const gloss = vi.spyOn(scratch.gloss, 'dispose');
    const nearColor = vi.spyOn(scratch.nearColor, 'dispose');
    const nearGloss = vi.spyOn(scratch.nearGloss, 'dispose');
    a.dispose();
    expect(color).not.toHaveBeenCalled();
    expect(gloss).not.toHaveBeenCalled();
    expect(nearColor).not.toHaveBeenCalled();
    expect(nearGloss).not.toHaveBeenCalled();
  });
});

describe('PaintSurface のすき間の近さの表', () => {
  it('塗りを白に戻すたびに、描画器で共有する近さの表を作り直す', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const s = scratchFor(renderer);
    drawn.length = 0;
    a.rebuild([]);
    expect(drawn).toContain(s.nearColor);
    expect(drawn).toContain(s.nearGloss);
  });

  it('すき間へ広げ直すときは近さの表を読むだけで、描き直さない', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const s = scratchFor(renderer);
    drawn.length = 0;
    a.apply([]);
    a.flush();
    expect(drawn).toContain(s.color);
    expect(drawn).not.toContain(s.nearColor);
    expect(drawn).not.toContain(s.nearGloss);
  });
});
