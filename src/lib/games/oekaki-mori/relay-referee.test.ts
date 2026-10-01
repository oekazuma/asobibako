import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { RelayReferee } from './relay-referee';

const frames = vi.hoisted(() => ({ list: [] as ((dt: number) => void)[] }));
vi.mock('$lib/loop', () => ({
  animate: (f: (dt: number) => void) => {
    frames.list.push(f);
    return () => {};
  }
}));
const frame = (dt = 0) => frames.list.forEach((f) => f(dt));

function fakeParty(members: Seat[]) {
  const acts = new Set<(m: Message, from: Seat) => void>();
  const told: [Seat, Message][] = [];
  const party = {
    host: true,
    members,
    onAct: (l: (m: Message, from: Seat) => void) => (acts.add(l), () => acts.delete(l)),
    tell: (to: Seat | 'all', m: Message) => {
      for (const seat of to === 'all' ? members : [to]) told.push([seat, m]);
    }
  } as unknown as Party;
  const act = (m: Message, from: Seat) => acts.forEach((l) => l(m, from));
  return { party, told, act };
}

const of = (told: [Seat, Message][], t: string) => told.filter(([, m]) => m.t === t);

describe('RelayReferee', () => {
  it('だんの頭に、受け持ちを 1 人 1 回だけ送る', () => {
    frames.list = [];
    const { party, told } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    frame();
    expect(of(told, 'relayTask').map(([seat]) => seat)).toEqual([1, 2]);
  });

  it('全員ができたら次のだんの受け持ちを送り、見え方は変わったときだけ送る', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    const views = of(told, 'relayView').length;
    frame();
    expect(of(told, 'relayView').length).toBe(views);
    act({ t: 'relayDone' }, 1);
    act({ t: 'relayDone' }, 2);
    frame();
    const tasks = of(told, 'relayTask').map(([, m]) => (m.task as { kind: string }).kind);
    expect(tasks).toEqual(['draw', 'draw', 'guess', 'guess']);
  });

  it('ふりかえりは親の「つぎ」だけで 1 こまずつ送り、戻った子にはめくり終えたこまを送り直す', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    for (let i = 0; i < 4; i++) {
      act({ t: 'relayDone', text: 'くま' }, 1);
      act({ t: 'relayDone', text: 'くま' }, 2);
      frame();
    }
    told.length = 0;
    act({ t: 'relayNext' }, 2);
    expect(of(told, 'relayPage')).toEqual([]);
    act({ t: 'relayNext' }, 1);
    act({ t: 'relayNext' }, 1);
    expect(of(told, 'relayPage').filter(([seat]) => seat === 2)).toHaveLength(2);
    told.length = 0;
    act({ t: 'join' }, 2);
    const resent = of(told, 'relayPage').filter(([seat]) => seat === 2);
    expect(resent.map(([, m]) => m.index)).toEqual([0, 1, 2]);
  });
});
