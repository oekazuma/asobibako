import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, type Settings as S } from './referee';
import Settings from './Settings.svelte';

function show(cpu: boolean) {
  const settings = $state<S>({ ...DEFAULTS });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Settings, { target, props: { settings, players: 2, cpu, onstart: vi.fn(), onclose: vi.fn() } });
  flushSync();
  return { target, done: () => unmount(app) };
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
});
