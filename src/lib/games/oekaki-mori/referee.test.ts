import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { Referee } from './referee';

// 審判はフレームごとに時間を進めるが、このテストは操作への返事だけを見る
vi.mock('$lib/loop', () => ({ animate: () => () => {} }));

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

describe('Referee', () => {
  it('打っている字は、描く人にはそのまま、ほかの当てる人には字数だけ送り、本人には送らない', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'start' }, 1);
    told.length = 0;
    act({ t: 'typing', text: 'りん' }, 2);
    const typing = told.filter(([, m]) => m.t === 'typing');
    expect(typing).toEqual([
      [1, { t: 'typing', seat: 2, text: 'りん' }],
      [3, { t: 'typing', seat: 2, text: '●●' }]
    ]);
  });

  it('描いていないあいだや、描く人の打った字は配らない', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'typing', text: 'り' }, 2);
    act({ t: 'start' }, 1);
    act({ t: 'typing', text: 'り' }, 1);
    expect(told.filter(([, m]) => m.t === 'typing')).toEqual([]);
  });

  it('戻った人をルールに戻し、その人に見え方を送り直す', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'leave' }, 3);
    told.length = 0;
    act({ t: 'join' }, 3);
    const views = told.filter(([seat, m]) => seat === 3 && m.t === 'view');
    expect(views).toHaveLength(1);
    expect((views[0][1].view as { players: Seat[] }).players).toEqual([1, 2, 3]);
  });

  // 50 音盤は「こたえる」を送ってから空を知らせるので、当てた人の空を捨てると ● が残る
  it('当てたあとや描く時間のあとでも、空の字は配って消させる', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'start' }, 1);
    const word = String(
      (told.findLast(([seat, m]) => seat === 1 && m.t === 'view')![1].view as { word: string }).word
    );
    act({ t: 'typing', text: word }, 2);
    told.length = 0;
    act({ t: 'guess', text: word }, 2);
    act({ t: 'typing', text: '' }, 2);
    const typing = told.filter(([, m]) => m.t === 'typing').map(([seat, m]) => [seat, m.text]);
    expect(typing).toEqual([
      [1, ''],
      [3, '']
    ]);
  });
});
