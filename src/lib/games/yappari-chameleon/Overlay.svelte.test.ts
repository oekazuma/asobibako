import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { Match } from './match.svelte';
import Overlay from './Overlay.svelte';
import type { PlayRole } from './play.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import type { Session } from './session.svelte';

function show(role: PlayRole, v: Partial<View>, me: Seat = 1, extra: Partial<Record<string, unknown>> = {}) {
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
    canTaunt: match.phase === 'lobby' || match.hiding,
    ...extra
  } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Overlay, { target, props: { session, radius: 70, center: () => [0, 0], onleave: vi.fn() } });
  flushSync();
  const labels = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, labels, session, done: () => unmount(app) };
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

  it('探索のハンターには見落とした敵を出し、隠すと畳み、開き直せる。設定がオフなら出さない', () => {
    const v: Partial<View> = { phase: 'search', overlook: { 2: { 1: 12 } } };
    const { target, done } = show('hunter', v, 2);
    const list = () => target.querySelector('.overlooked');
    expect(list()?.textContent).toContain('見落とした敵');
    expect(list()?.textContent).toContain('プレイヤー1');
    expect(list()?.textContent).toContain('12');
    [...target.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === '隠す')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(list()).toBeNull();
    [...target.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === '見落とした敵')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(list()).not.toBeNull();
    done();
    const off = show('hunter', { ...v, settings: { ...DEFAULTS, overlook: false } }, 2);
    expect(off.target.querySelector('.overlooked')).toBeNull();
    off.done();
  });

  it('答え合わせでは、見落とされた場所と、ええやんの一覧を出す', () => {
    const { target, done } = show('hider', {
      phase: 'reveal',
      winner: 'chameleon',
      hid: [1],
      overlook: { 2: { 1: 7 } },
      spots: { 1: [-16, 0, 10] },
      likes: { 1: 2 }
    });
    expect(target.querySelector('.spotted')?.textContent).toContain('見落とされた場所');
    expect(target.querySelector('.spotted')?.textContent).toContain('キッチン');
    const row = target.querySelector('.iine li')!;
    expect(row.textContent).toContain('プレイヤー1');
    expect(row.textContent).toContain('2');
    // 自分（プレイヤー1）には押せない
    expect(target.querySelector('.iine button')).toBeNull();
    done();
  });

  it('ええやんを押すと、押した人を送る。押したあとは押せない', () => {
    const v: Partial<View> = { phase: 'reveal', winner: 'chameleon', hid: [1] };
    const { target, session, done } = show('hunter', v, 2);
    const button = target.querySelector<HTMLButtonElement>('.iine button[data-seat="1"]')!;
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(session.like).toHaveBeenCalledWith(1);
    done();
    const pressed = show('hunter', { ...v, liked: [2] }, 2);
    expect(pressed.target.querySelector<HTMLButtonElement>('.iine button')!.disabled).toBe(true);
    pressed.done();
  });

  it('埋まっているあいだは、画面の中央に警告を出す', () => {
    const { target, done } = show('hider', { phase: 'hide' }, 1, { buried: true });
    expect(target.textContent).toContain('体が埋まりすぎている！この状態が続くと位置が公開されます');
    done();
  });
});
