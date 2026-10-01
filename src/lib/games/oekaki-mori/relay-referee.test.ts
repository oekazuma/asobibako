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
    act({ t: 'relayDone', step: 0 }, 1);
    act({ t: 'relayDone', step: 0 }, 2);
    frame();
    const tasks = of(told, 'relayTask').map(([, m]) => (m.task as { kind: string }).kind);
    expect(tasks).toEqual(['draw', 'draw', 'guess', 'guess']);
  });

  it('ふりかえりは親の「つぎ」だけで 1 こまずつ送り、戻った子にはめくり終えたこまを送り直す', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    for (let i = 0; i < 4; i++) {
      act({ t: 'relayDone', step: i, text: 'くま' }, 1);
      act({ t: 'relayDone', step: i, text: 'くま' }, 2);
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

  // 二度押しや時間切れまぎわの「できた」が遅れて届くと、次のだんのこまを勝手に終わらせてしまう
  it('いまのだんでない「できた」は受けない', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    act({ t: 'relayDone', step: 0 }, 1);
    act({ t: 'relayDone', step: 0 }, 2);
    frame();
    act({ t: 'relayDone', step: 0 }, 2);
    act({ t: 'relayDone', step: 1, text: 'いぬ' }, 1);
    frame();
    const views = of(told, 'relayView').map(([, m]) => m);
    expect(views.at(-1)).toMatchObject({ step: 1, done: [1] });
  });

  // 前のだんの打ちかけの字が残ると、何も打たなかった人の答えになってしまう
  it('だんが替わったら、打ちかけの字を忘れる', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    act({ t: 'typing', text: 'りん' }, 2);
    act({ t: 'relayDone', step: 0 }, 1);
    act({ t: 'relayDone', step: 0 }, 2);
    frame();
    act({ t: 'relayDone', step: 1, text: 'いぬ' }, 1);
    frame(31);
    const tasks = of(told, 'relayTask').filter(([seat, m]) => seat === 1 && m.step === 2);
    expect((tasks[0][1].task as { word: string }).word).not.toBe('りん');
  });
});
