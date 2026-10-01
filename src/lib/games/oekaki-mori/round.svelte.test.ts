import { afterEach, describe, expect, it, vi } from 'vitest';
import type { View } from './engine';
import { Round } from './round.svelte';

const sound = vi.hoisted(() => ({
  tick: vi.fn(),
  turn: vi.fn(),
  right: vi.fn(),
  wrong: vi.fn(),
  close: vi.fn(),
  buzz: vi.fn()
}));
vi.mock('./sounds', () => ({ sounds: sound }));

const view = (over: Partial<View>): View => ({
  mode: 'egokoro',
  phase: 'draw',
  turn: 0,
  turns: 4,
  drawer: 1,
  players: [1, 2, 3],
  scores: { 1: 0, 2: 0, 3: 0 },
  left: 80,
  word: 'ねこ',
  mask: '○○',
  solved: [],
  buzzer: null,
  answerLeft: 0,
  options: null,
  out: [],
  ...over
});

describe('Round', () => {
  afterEach(() => vi.clearAllMocks());

  it('外れた答えをその番の絵に付け、じかんぎれは入れず、番が変わると空にする', () => {
    const r = new Round();
    r.receive({ t: 'view', view: view({}) });
    r.receive({ t: 'bubble', seat: 2, text: 'たぬき' });
    r.receive({ t: 'bubble', seat: 3, text: 'じかんぎれ', note: true });
    r.receive({ t: 'view', view: view({ phase: 'reveal' }) });
    expect(r.gallery[0].misses).toEqual([{ by: 2, text: 'たぬき' }]);
    r.receive({ t: 'view', view: view({ turn: 1 }) });
    r.receive({ t: 'view', view: view({ turn: 1, phase: 'reveal' }) });
    expect(r.gallery[1].misses).toEqual([]);
  });

  it('戻った子に送られた絵のまちがい答えをそのまま残す', () => {
    const r = new Round();
    r.receive({ t: 'drawing', drawing: { word: 'ねこ', by: 1, strokes: [], misses: [{ by: 2, text: 'いぬ' }] } });
    expect(r.gallery[0].misses).toEqual([{ by: 2, text: 'いぬ' }]);
  });

  it('スタンプは同時に 6 つまでにし、古いものから消す', () => {
    const r = new Round();
    for (let i = 0; i < 8; i++) r.receive({ t: 'stamp', seat: 2, id: 'like' });
    expect(r.stamps).toHaveLength(6);
    expect(r.stamps[0].key).toBe(3);
  });

  it('描く時間の残り 10 秒からは 1 秒ごとに音を鳴らし、3 秒からは高い音にする', () => {
    const r = new Round();
    for (const left of [12, 11, 10, 10, 9, 3]) r.receive({ t: 'view', view: view({ left }) });
    expect(sound.tick.mock.calls).toEqual([[false], [false], [true]]);
  });

  // 2 人の遊びで 1 人が抜けて終わると番が進まないので、画面が替わるときに消さないと次の遊びに混ざる
  it('画面が替わったら、前の遊びの外れた答えと打っている字を消す', () => {
    const r = new Round();
    r.receive({ t: 'view', view: view({}) });
    r.receive({ t: 'bubble', seat: 2, text: 'たぬき' });
    r.receive({ t: 'typing', seat: 2, text: 'た' });
    r.receive({ t: 'screen', screen: 'mode' });
    expect(r.typing).toEqual({});
    r.receive({ t: 'view', view: view({}) });
    r.receive({ t: 'view', view: view({ phase: 'reveal' }) });
    expect(r.gallery[0].misses).toEqual([]);
  });
});
