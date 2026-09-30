import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIZE } from '$lib/coloring/regions';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import Together from './Together.svelte';

const book = vi.hoisted(() => ({ saveWork: vi.fn(async () => {}) }));

vi.mock('$lib/coloring/book', async (original) => ({
  ...(await original<typeof import('$lib/coloring/book')>()),
  saveWork: book.saveWork
}));
vi.mock('$lib/coloring/art', () => ({
  templateArt: (template: unknown) => ({ kind: 'template', template, mask: new Uint8Array(SIZE * SIZE) }),
  photoArt: (mask: Uint8Array) => ({ kind: 'photo', mask }),
  snapshot: () => 'data:image/jpeg;base64,'
}));
vi.mock('$lib/coloring/Canvas.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));
vi.mock('$lib/coloring/sounds', () => ({ sounds: { fill: () => {}, undo: () => {}, done: () => {} } }));
vi.mock('$lib/share', () => ({ saveImage: () => {} }));

/** 親 1 台だけの Party。知らせも操作も手元で回す */
function soloHost(): Party {
  const tells = new Set<(m: Message) => void>();
  const acts = new Set<(m: Message, from: Seat) => void>();
  return {
    host: true,
    me: 1,
    members: [1],
    onTell: (l: (m: Message) => void) => (tells.add(l), () => tells.delete(l)),
    onAct: (l: (m: Message, from: Seat) => void) => (acts.add(l), () => acts.delete(l)),
    tell: (_to: unknown, m: Message) => tells.forEach((l) => l(JSON.parse(JSON.stringify(m)))),
    act: (m: Message) => acts.forEach((l) => l(m, 1))
  } as unknown as Party;
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r));
    await tick();
  }
  flushSync();
};

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Together, { target, props: { party: soloHost(), onagain: () => {} } });
  flushSync();
  const button = (label: string) =>
    [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label
    );
  return { app, target, button };
}

describe('Together', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    book.saveWork.mockClear();
  });

  // 線画を配り終える前に別の絵を押すと 2 枚配られ、親の塗り手順と画面の色が食い違う
  it('親が絵を選んだら、配り終えるまで絵を選び直せない', async () => {
    const { app, button } = show();
    button('りんご')!.click();
    flushSync();
    expect(button('おうち')).toBeUndefined();
    await settle();
    unmount(app);
  });

  it('何も塗らずに できた！ を押しても、ぬりえちょうに白紙を入れない', async () => {
    const { app, target, button } = show();
    button('りんご')!.click();
    await settle();
    expect(target.querySelector('.stub-sheet')).not.toBeNull();
    button('できた！')!.click();
    await settle();
    expect(target.textContent).toContain('できた！');
    expect(book.saveWork).not.toHaveBeenCalled();
    unmount(app);
  });
});
