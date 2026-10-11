import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, type Settings as S } from './referee';
import Settings from './Settings.svelte';

function show(cpu: boolean) {
  const settings = $state<S>({ ...DEFAULTS });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Settings, { target, props: { settings, players: 2, cpu, onstart: vi.fn(), onclose: vi.fn() } });
  flushSync();
  return { target, settings, done: () => unmount(app) };
}

describe('Settings', () => {
  it('CPU と遊ぶでは、ゲームモードとハンターの人数の行を出さない（CPU の設定で決める）', () => {
    const cpu = show(true);
    expect(cpu.target.textContent).not.toContain('ゲームモード');
    expect(cpu.target.textContent).not.toContain('ハンターの人数');
    expect(cpu.target.textContent).toContain('ハンター待機時間（秒）');
    cpu.done();
    const plain = show(false);
    expect(plain.target.textContent).toContain('ゲームモード');
    plain.done();
  });

  it('プチカメレオンを許可の行は既定でオフで、オンを押すと許可する。CPU と遊ぶでは出さない（CPU の設定で決める）', () => {
    const { target, settings, done } = show(false);
    const row = [...target.querySelectorAll('.row')].find((r) => r.textContent?.includes('プチカメレオンを許可'))!;
    const pick = (text: string) => [...row.querySelectorAll('button')].find((b) => b.textContent === text)!;
    expect(pick('オフ').classList.contains('on')).toBe(true);
    pick('オン').click();
    flushSync();
    expect(settings.petit).toBe(true);
    expect(pick('オン').classList.contains('on')).toBe(true);
    done();
    const cpu = show(true);
    expect(cpu.target.textContent).not.toContain('プチカメレオンを許可');
    cpu.done();
  });
});
