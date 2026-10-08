import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LinkButton from './LinkButton.svelte';
import { LINK_FUSE, LINK_SHOW } from './link';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

describe('いっしょに！のボタン', () => {
  afterEach(() => (document.body.innerHTML = ''));

  function show(mode: 'none' | 'ready' | 'waiting' | 'partner') {
    let pressed = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(LinkButton, { target, props: { mode, onpress: () => (pressed += 1) } });
    flushSync();
    return { target, app, pressed: () => pressed };
  }

  it('満タンでなければ出ない', () => {
    const { target, app } = show('none');
    expect(target.querySelector('[data-link]')).toBeNull();
    unmount(app);
  });

  it('押せるときは「いっしょに！」で、押すと onpress', () => {
    const { target, app, pressed } = show('ready');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('いっしょに！');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(1);
    unmount(app);
  });

  it('自分が押したあとは「相棒を待っています」で、もう押せない', () => {
    const { target, app, pressed } = show('waiting');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('相棒を待っています');
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(0);
    unmount(app);
  });

  it('相棒が押したら「相棒が押した！」で光り、押せる', () => {
    const { target, app, pressed } = show('partner');
    const b = target.querySelector('[data-link]') as HTMLButtonElement;
    expect(b.textContent).toContain('相棒が押した！');
    expect(b.classList.contains('partner')).toBe(true);
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(pressed()).toBe(1);
    unmount(app);
  });

  it('スペースキーでも押せる', () => {
    const { app, pressed } = show('ready');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(pressed()).toBe(1);
    unmount(app);
  });
});

describe('連携の帯', () => {
  it('出来事 link で帯を出し、止めと絵のぶんが過ぎたら消す。帯のあいだも選ぶ画面にはならない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    const p = new Prompts(w);
    w.events.push({ type: 'link', a: 'dog', b: 'cat', name: 'X × Y' });
    p.take();
    expect(p.link?.name).toBe('X × Y');
    expect(p.busy).toBe(false);
    // 帯の時計はゲームの時間で進むので、ゲームの時刻を進めてから呼ぶ
    w.time += LINK_FUSE + LINK_SHOW + 0.01;
    p.next(null, LINK_FUSE + LINK_SHOW + 0.01);
    expect(p.link).toBeNull();
  });
});
