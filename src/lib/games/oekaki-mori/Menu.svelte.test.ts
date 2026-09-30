import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Party } from '$lib/net/party.svelte';
import Menu from './Menu.svelte';

const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

function show(host: boolean) {
  const party = { host, members: [1, 2], close: vi.fn() } as unknown as Party;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Menu, { target, props: { party, oninvite: () => {} } });
  flushSync();
  const press = (selector: string, label?: string) => {
    const buttons = [...target.querySelectorAll<HTMLButtonElement>(selector)];
    (label ? buttons.find((b) => b.textContent?.trim() === label) : buttons[0])!.click();
    flushSync();
  };
  press('button[aria-label="メニュー"]');
  return { app, target, party, press };
}

describe('Menu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // 押し間違いで抜けるとつながりが切れるので、確かめてから抜ける
  it('ぬける… で確かめを出し、ぬけるを押したときだけ閉じて一覧へ戻る', () => {
    const { app, target, party, press } = show(true);
    press('button', 'ぬける…');
    expect(target.textContent).toContain('みんなの あそびが おわるよ');
    press('button', 'もどる');
    expect(party.close).not.toHaveBeenCalled();
    press('button', 'ぬける…');
    press('.confirm .leave');
    expect(party.close).toHaveBeenCalled();
    expect(nav.goto).toHaveBeenCalled();
    unmount(app);
  });

  it('子の確かめは、親が呼び直せることを知らせる', () => {
    const { app, target, press } = show(false);
    press('button', 'ぬける…');
    expect(target.textContent).toContain('おやが よびなおせるよ');
    unmount(app);
  });
});
