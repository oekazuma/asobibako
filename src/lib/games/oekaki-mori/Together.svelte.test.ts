import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIZE } from '$lib/coloring/regions';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import Together from './Together.svelte';

const book = vi.hoisted(() => ({ saveWork: vi.fn(async () => {}) }));
const sound = vi.hoisted(() => ({ fill: vi.fn(), undo: vi.fn(), done: vi.fn() }));
/** 親が全員へ配った知らせ */
const sent: Message[] = [];

vi.mock('$lib/coloring/book', async (original) => ({
  ...(await original<typeof import('$lib/coloring/book')>()),
  saveWork: book.saveWork
}));
vi.mock('$lib/coloring/art', () => ({
  templateArt: (template: unknown) => ({
    kind: 'template',
    template,
    mask: new Uint8Array(SIZE * SIZE),
    cover: new Uint8Array(SIZE * SIZE)
  }),
  photoArt: (mask: Uint8Array) => ({ kind: 'photo', mask }),
  snapshot: () => 'data:image/jpeg;base64,'
}));
vi.mock('$lib/coloring/Canvas.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));
vi.mock('$lib/coloring/sounds', () => ({ sounds: sound }));
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
    tell: (_to: unknown, m: Message) => {
      sent.push(m);
      tells.forEach((l) => l(JSON.parse(JSON.stringify(m))));
    },
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

function show(onagain = () => {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const party = soloHost();
  const app = mount(Together, { target, props: { party, onagain } });
  flushSync();
  const button = (label: string) =>
    [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label
    );
  return { app, target, button, party };
}

describe('Together', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    book.saveWork.mockClear();
    Object.values(sound).forEach((f) => f.mockClear());
    sent.length = 0;
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
  it('できた！ のあとに届いた塗りは受け付けない', async () => {
    const { app, button, party } = show();
    button('りんご')!.click();
    await settle();
    button('できた！')!.click();
    await settle();
    const before = sent.length;
    party.act({ t: 'paint', region: 0, color: '#f00' });
    await settle();
    expect(sent.slice(before).filter((m) => m.t === 'painted')).toEqual([]);
    unmount(app);
  });

  it('色が変わらないタップでは音を鳴らさず、戻したときだけ戻す音を鳴らす', async () => {
    const { app, target, button } = show();
    button('りんご')!.click();
    await settle();
    button('1つ もどす')!.click();
    await settle();
    expect(sound.undo).not.toHaveBeenCalled();
    target.querySelector<HTMLButtonElement>('.stub-tap')!.click();
    await settle();
    target.querySelector<HTMLButtonElement>('.stub-tap')!.click();
    await settle();
    expect(sound.fill).toHaveBeenCalledTimes(1);
    button('1つ もどす')!.click();
    await settle();
    expect(sound.undo).toHaveBeenCalledTimes(1);
    unmount(app);
  });

  it('線画を受け取れなかったら、そう出す', async () => {
    const { app, target, party } = show();
    party.tell('all', { t: 'art', template: null, lines: '!!!' });
    await settle();
    expect(target.textContent).toContain('えを うけとれませんでした');
    unmount(app);
  });

  it('親は絵を選ぶ画面から遊び方選びに戻れる', async () => {
    const onagain = vi.fn();
    const { app, button } = show(onagain);
    button('あそびかたに もどる')!.click();
    expect(onagain).toHaveBeenCalled();
    unmount(app);
  });
});
