import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { Match } from './match.svelte';
import Overlay from './Overlay.svelte';
import type { PlayRole } from './play.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import type { Session } from './session.svelte';

function show(role: PlayRole, v: Partial<View>, me: Seat = 1) {
  const match = new Match(() => me);
  match.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hunter' }, ...v });
  const play = {
    role,
    mode: role === 'hider' ? 'walk' : 'eye',
    crouch: false,
    stick: { active: false, x: 0, y: 0, ox: 0, oy: 0 },
    wheel: null,
    cling: null,
    nearWall: false,
    pose: 'stand',
    lock: false,
    interrupt: vi.fn()
  };
  const session = {
    match,
    play,
    party: { host: me === 1, members: [1, 2], away: [] },
    plates: [],
    cool: 0,
    tootWait: 0,
    watching: 2,
    canTaunt: match.phase === 'lobby' || match.hiding
  } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Overlay, { target, props: { session, radius: 70, center: () => [0, 0], onleave: vi.fn() } });
  flushSync();
  const labels = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, labels, done: () => unmount(app) };
}

describe('Overlay', () => {
  it('ロビーでは右の列にハンター希望と挑発、上に親のマップの設定を出す', () => {
    const { labels, done } = show('hider', { phase: 'lobby' });
    expect(labels()).toEqual(expect.arrayContaining(['ハンター希望', '挑発', 'マップの設定']));
    done();
  });

  it('隠れタイムの隠れる人には挑発ともうええよ、ハンターには撃つボタンと十字', () => {
    const hider = show('hider', { phase: 'hide' });
    expect(hider.labels()).toEqual(expect.arrayContaining(['挑発', '隠れタイムを飛ばす 0/2']));
    hider.done();
    const hunter = show('hunter', { phase: 'search' }, 2);
    expect(hunter.labels()).toEqual(expect.arrayContaining(['うつ', 'しゃがむ', 'ジャンプ']));
    expect(hunter.labels()).not.toContain('挑発');
    expect(hunter.target.querySelector('.cross')).not.toBeNull();
    hunter.done();
  });

  it('控室で待つハンターにはフリーカメラを出さない', () => {
    const waiting = show('hider', { phase: 'hide' }, 2);
    expect(waiting.labels()).not.toContain('フリーカメラ');
    waiting.done();
    const hider = show('hider', { phase: 'hide' });
    expect(hider.labels()).toContain('フリーカメラ');
    hider.done();
  });

  it('観戦中は左下に観戦中と見ている人を出す', () => {
    const { target, done } = show('watch', { phase: 'search', found: [1], settings: { ...DEFAULTS, mode: 'normal' } });
    expect(target.textContent).toContain('観戦中');
    expect(target.textContent).toContain('プレイヤー2');
    done();
  });

  it('答え合わせでは勝者の言葉を出す', () => {
    const { target, done } = show('hider', { phase: 'reveal', winner: 'chameleon' });
    expect(target.textContent).toContain('勝者カメレオン!');
    done();
  });
});
