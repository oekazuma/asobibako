import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OekakiMori from './OekakiMori.svelte';

const audio = vi.hoisted(() => ({ wake: vi.fn(), toggleMute: vi.fn() }));

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  wake: audio.wake,
  toggleMute: audio.toggleMute,
  tone: () => {},
  sweep: () => {}
}));

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(OekakiMori, { target });
  flushSync();
  return { app, target };
}

describe('OekakiMori', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // 当てる人は盤面に触れず 50 音盤とボタンだけを押すので、画面のどこに触れても音を起こす
  it('画面のどこを押しても音を起こす', () => {
    const { app, target } = show();
    target.querySelector('main')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(audio.wake).toHaveBeenCalled();
    unmount(app);
  });

  it('ロビーにミュートのボタンがある', () => {
    const { app, target } = show();
    target.querySelector<HTMLButtonElement>('button[aria-label="ミュート"]')!.click();
    expect(audio.toggleMute).toHaveBeenCalled();
    unmount(app);
  });
});
