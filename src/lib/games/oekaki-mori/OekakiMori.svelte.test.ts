import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party } from '$lib/net/party.svelte';
import OekakiMori from './OekakiMori.svelte';
import { lobby } from './test/lobby-hold';

const audio = vi.hoisted(() => ({ wake: vi.fn(), toggleMute: vi.fn() }));

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  wake: audio.wake,
  toggleMute: audio.toggleMute,
  tone: () => {},
  sweep: () => {}
}));

vi.mock('./Lobby.svelte', async () => ({ default: (await import('./test/LobbyStub.svelte')).default }));
vi.mock('./Play.svelte', async () => ({ default: (await import('./test/PlayStub.svelte')).default }));
vi.mock('./Menu.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));

/** 子の Party。親からの知らせをテストから流す */
function guest() {
  const tells = new Set<(m: Message) => void>();
  const party = {
    host: false,
    me: 2,
    members: [1, 2],
    lost: false,
    away: [],
    onTell: (l: (m: Message) => void) => (tells.add(l), () => tells.delete(l)),
    onAct: () => () => {},
    act: () => {},
    close: () => {}
  } as unknown as Party;
  const tell = (m: Message) => {
    tells.forEach((l) => l(m));
    flushSync();
  };
  return { party, tell };
}

const view = (turn: number) => ({
  mode: 'egokoro',
  phase: 'draw',
  turn,
  turns: 4,
  drawer: 1,
  players: [1, 2],
  scores: { 1: 0, 2: 0 },
  left: 80,
  word: null,
  mask: '○○',
  solved: [],
  buzzer: null,
  answerLeft: 0,
  options: null,
  out: []
});

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(OekakiMori, { target });
  flushSync();
  return { app, target };
}

describe('OekakiMori', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // 当てる人は盤面に触れず 50 音盤とボタンだけを押すので、画面のどこに触れても音を起こす
  it('画面のどこを押しても音を起こす', () => {
    const { app, target } = show();
    target.querySelector('main')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(audio.wake).toHaveBeenCalled();
    unmount(app);
  });

  it('ロビーにミュートのボタンがある', () => {
    const { app, target } = show();
    target.querySelector<HTMLButtonElement>('button[aria-label="ミュート"]')!.click();
    expect(audio.toggleMute).toHaveBeenCalled();
    unmount(app);
  });

  // つなぎ直す前の見え方が残ると、番が変わったとみなして送り直した絵を消してしまう
  it('つなぎ直したら、前のつながりの見え方を捨て、送り直された絵を残す', () => {
    const { app, target } = show();
    const before = guest();
    lobby.onparty!(before.party);
    flushSync();
    before.tell({ t: 'view', view: view(1) });
    const after = guest();
    lobby.onparty!(after.party);
    flushSync();
    after.tell({ t: 'sync', strokes: [{ color: '#000', size: 0.01, pts: [0, 0] }] });
    after.tell({ t: 'view', view: view(2) });
    expect(target.querySelector('.stub-strokes')?.textContent).toBe('1');
    unmount(app);
  });
});
