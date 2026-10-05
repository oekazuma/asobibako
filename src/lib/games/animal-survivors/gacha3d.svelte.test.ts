import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Gacha3D from './Gacha3D.svelte';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('3D のガチャの重ね', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('WebGL が作れないときは 2D で品を見せ、押すと閉じる', async () => {
    const closed: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, {
      target,
      props: { gears: ['owl:2'], onclose: () => closed.push('x'), scene: () => Promise.reject(new Error('no webgl')) }
    });
    await tick();
    flushSync();
    expect(target.textContent).toContain('知恵のふくろう');
    (target.querySelector('[data-close]') as HTMLButtonElement).click();
    expect(closed).toEqual(['x']);
    unmount(app);
  });

  it('閉じると場面を捨てる', async () => {
    const dispose = vi.fn();
    const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, { target, props: { gears: ['owl:2'], onclose: () => {}, scene: async () => fake } });
    await tick();
    unmount(app);
    expect(dispose).toHaveBeenCalled();
  });

  it('とばすで品を見せる', async () => {
    const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose() {} };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, { target, props: { gears: ['owl:2'], onclose: () => {}, scene: async () => fake } });
    await tick();
    (target.querySelector('[data-skip]') as HTMLButtonElement).click();
    flushSync();
    expect(target.textContent).toContain('知恵のふくろう');
    unmount(app);
  });

  it('読み込みの途中でとばしても、1 回押せば閉じる', async () => {
    const closed: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha3D, {
      target,
      props: { gears: ['owl:2'], onclose: () => closed.push('x'), scene: () => new Promise(() => {}) }
    });
    await tick();
    (target.querySelector('[data-skip]') as HTMLButtonElement).click();
    flushSync();
    await new Promise((r) => setTimeout(r, 500));
    const c = target.querySelector('canvas')!;
    c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    expect(closed).toEqual(['x']);
    unmount(app);
  });

  it('10 連をとばすと 10 この品を並べる', async () => {
    const fake = { resize() {}, render() {}, handle: () => ({ x: 0, y: 0 }), dispose() {} };
    const target = document.body.appendChild(document.createElement('div'));
    const gears = ['owl:0', 'cat:1', 'oni:2', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0', 'owl:0'] as const;
    const app = mount(Gacha3D, { target, props: { gears: [...gears], onclose: () => {}, scene: async () => fake } });
    await tick();
    (target.querySelector('[data-skip]') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelectorAll('[data-got]').length).toBe(10);
    expect(target.textContent).toContain('鬼のツノ');
    unmount(app);
  });

  it('WebGL が作れない 10 連は 2D で 10 こ並べる', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const gears = Array.from({ length: 10 }, () => 'owl:0' as const);
    const app = mount(Gacha3D, {
      target,
      props: { gears, onclose: () => {}, scene: () => Promise.reject(new Error('x')) }
    });
    await tick();
    flushSync();
    expect(target.querySelectorAll('[data-got]').length).toBe(10);
    unmount(app);
  });
});
