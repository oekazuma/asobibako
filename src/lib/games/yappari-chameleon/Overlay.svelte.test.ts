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
    tps: false,
    toggleTps: vi.fn(),
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
    buried: false,
    like: vi.fn(),
    canTaunt: match.phase === 'lobby' || match.hiding
  } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Overlay, { target, props: { session, radius: 70, center: () => [0, 0], onleave: vi.fn() } });
  flushSync();
  const labels = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, labels, done: () => unmount(app) };
}

describe('Overlay', () => {
  it('ロビーでは右の列に挑発、上に親のマップの設定を出し、ハンター希望のボタンは無い（台に乗る）', () => {
    const { labels, done } = show('hider', { phase: 'lobby' });
    expect(labels()).toEqual(expect.arrayContaining(['挑発', 'マップの設定']));
    expect(labels()).not.toContain('ハンター希望');
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

  it('ダブルの探索と答え合わせでは、左に順位表を出す', () => {
    const settings = { ...DEFAULTS, mode: 'double' } as const;
    const roles = { 1: 'hunter', 2: 'hunter' } as const;
    const { target, done } = show('hunter', { phase: 'search', settings, roles, hid: [1, 2], caught: { 2: [1] } }, 1);
    const rows = [...target.querySelectorAll('.ranking li')].map((li) => li.textContent?.replace(/\s+/g, ''));
    expect(rows).toEqual(['#1プレイヤー21/1', '#2プレイヤー10/1']);
    expect(target.querySelector('.ranking li.me')?.textContent).toContain('プレイヤー1');
    expect(target.querySelectorAll('.ranking li.me')).toHaveLength(1);
    expect(target.querySelector<HTMLElement>('.side')!.style.pointerEvents).toBe('none');
    done();
  });

  it('紹介のモード名は、ダブルのときマゼンタ', () => {
    const { target, done } = show('hider', { phase: 'intro', settings: { ...DEFAULTS, mode: 'double' } });
    expect(['#e8399c', 'rgb(232, 57, 156)']).toContain(target.querySelector<HTMLElement>('.intro .name')?.style.color);
    expect(target.textContent).toContain('その後全員で探索し、最初に全員見つければ勝利');
    done();
  });
});
