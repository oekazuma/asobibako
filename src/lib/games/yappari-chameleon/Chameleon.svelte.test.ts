import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Chameleon from './Chameleon.svelte';

vi.mock('$lib/audio.svelte', () => ({ wake: vi.fn(), tone: vi.fn(), sweep: vi.fn(), noise: vi.fn(), sfx: {} }));
vi.mock('./doll', async (orig) => ({
  ...(await orig<typeof import('./doll')>()),
  buildDoll: () => ({ pos: new Float32Array(), idx: new Uint32Array() })
}));
vi.mock('./atlas', () => ({ layAtlas: () => ({}) }));
vi.mock('./mansion/build', () => ({ buildMansion: () => ({}) }));
vi.mock('./world3d', () => ({
  World: class {
    constructor() {
      throw new Error('WebGL2 を作れない');
    }
  }
}));

describe('Chameleon', () => {
  it('3D を作れない端末では、準備中のままにせず理由とタイトルへ戻る口を出す', async () => {
    const onquit = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Chameleon, { target, props: { onquit } as never });
    await vi.waitFor(() => {
      flushSync();
      expect(target.textContent).toContain('この端末では 3D を表示できません');
    });
    expect(target.textContent).not.toContain('準備中');
    target.querySelector<HTMLButtonElement>('.failed button')!.click();
    expect(onquit).toHaveBeenCalledTimes(1);
    unmount(app);
  });
});
