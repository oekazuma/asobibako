import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import Hud from './Hud.svelte';
import { Match } from './match.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import type { Session } from './session.svelte';

function show(me: Seat, v: Partial<View>, play: { mode?: string; role?: string } = {}) {
  const match = new Match(() => me);
  match.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, ...v });
  const session = { match, play: { mode: 'walk', role: 'hider', ...play } } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Hud, { target, props: { session } });
  flushSync();
  return { target, done: () => unmount(app) };
}

describe('Hud', () => {
  it('隠れる人には、残り秒・フェーズの言葉・人形・残り人数・強制挑発の秒を出す', () => {
    const { target, done } = show(1, { phase: 'search', left: 42.2, taunts: { 1: 7 } });
    expect(target.querySelector('.num')?.textContent).toBe('43');
    expect(target.textContent).toContain('隠れつづけよう');
    expect(target.querySelectorAll('.white svg')).toHaveLength(2);
    expect(target.querySelectorAll('.red svg')).toHaveLength(1);
    expect(target.querySelector('.left')?.textContent).toContain('残り人数 2');
    expect(target.querySelector('.taunt')?.textContent).toBe('7');
    done();
  });

  it('強制挑発の秒は砂時計のすぐ右（ハンターの赤い人形より手前）に並べる', () => {
    const { target, done } = show(1, { phase: 'search', taunts: { 1: 7 } });
    expect(target.querySelector('.clock')?.nextElementSibling?.className).toContain('taunt');
    done();
  });

  it('強制挑発の秒は隠れタイムにも出し、間隔が 0 なら 0 を出す', () => {
    const { target, done } = show(1, { phase: 'hide', taunts: { 1: 0 } });
    expect(target.querySelector('.taunt')?.textContent).toBe('0');
    done();
  });

  it('ハンターには残り人数の代わりに、モード名と説明 2 行を出す', () => {
    const { target, done } = show(3, { phase: 'search' }, { role: 'hunter' });
    expect(target.querySelector('.left')).toBeNull();
    expect(target.querySelector('.mode')?.textContent).toContain('増え鬼');
    expect(target.textContent).toContain('探索時間');
    done();
  });

  it('ペイントモードのあいだは上の残り秒だけ', () => {
    const { target, done } = show(1, { phase: 'hide', left: 30 }, { mode: 'paint' });
    expect(target.querySelector('.num')?.textContent).toBe('30');
    expect(target.querySelector('.word')).toBeNull();
    expect(target.querySelector('.dolls')).toBeNull();
    expect(target.querySelector('.left')).toBeNull();
    done();
  });

  it('ダブルでは白い人形と残り人数を出さず、赤い人形を隠れた人の数だけ出し、モード名をマゼンタにする', () => {
    const roles = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
    const settings = { ...DEFAULTS, mode: 'double' } as const;
    const { target, done } = show(1, { phase: 'search', settings, roles, hid: [1, 2, 3] }, { role: 'hunter' });
    expect(target.querySelector('.white')).toBeNull();
    expect(target.querySelectorAll('.red svg')).toHaveLength(3);
    expect(target.textContent).toContain('全員を見つけよう');
    // happy-dom は書いた色をそのまま返すことがあるので、どちらの書き方も受ける
    expect(['#e8399c', 'rgb(232, 57, 156)']).toContain(target.querySelector<HTMLElement>('.mode .name')?.style.color);
    done();
  });
});
