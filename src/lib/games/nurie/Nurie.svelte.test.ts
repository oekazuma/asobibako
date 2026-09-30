import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Work } from '$lib/coloring/book';
import { SIZE } from '$lib/coloring/regions';
import Nurie from './Nurie.svelte';

const book = vi.hoisted(() => ({
  works: [] as Work[],
  saveWork: vi.fn(async () => {}),
  removeWork: vi.fn(async () => {})
}));

vi.mock('$lib/coloring/book', async (original) => ({
  ...(await original<typeof import('$lib/coloring/book')>()),
  listWorks: async () => book.works,
  saveWork: book.saveWork,
  removeWork: book.removeWork
}));
vi.mock('$lib/coloring/art', () => ({
  templateArt: (template: unknown) => ({ kind: 'template', template, mask: new Uint8Array(SIZE * SIZE) }),
  photoArt: (mask: Uint8Array) => ({ kind: 'photo', mask }),
  snapshot: () => 'data:image/jpeg;base64,'
}));
vi.mock('$lib/coloring/Canvas.svelte', async () => ({ default: (await import('./test/CanvasStub.svelte')).default }));
vi.mock('$lib/coloring/sounds', () => ({ sounds: { fill: () => {}, undo: () => {}, done: () => {} } }));
vi.mock('$lib/share', () => ({ saveImage: () => {} }));

const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
  flushSync();
};

async function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Nurie, { target, props: { level: 1, onfinish: () => {} } });
  await settle();
  const press = async (label: string) => {
    const b = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (x) => x.getAttribute('aria-label') === label || x.textContent?.trim() === label
    );
    if (!b) throw new Error(`no button ${label}`);
    b.click();
    await settle();
  };
  return { app, target, press };
}

describe('Nurie', () => {
  beforeEach(() => {
    book.works = [];
    book.saveWork.mockReset().mockResolvedValue(undefined);
    book.removeWork.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // iOS の IndexedDB は開くところで止まることがある。保存を待って画面が戻らないと、子どもは閉じるしかない
  it('できた！ は保存を待たずに、えらぶ画面へ戻る', async () => {
    book.saveWork.mockReturnValue(new Promise(() => {}));
    const { app, target, press } = await show();
    await press('りんご');
    await press('できた！');
    expect(target.textContent).toContain('どれを ぬる？');
    unmount(app);
  });

  it('ぜんぶ戻してから できた！ を押すと、ぬりえちょうから消して保存しない', async () => {
    const { app, press } = await show();
    await press('りんご');
    await press('1つ もどす');
    await press('できた！');
    expect(book.removeWork).toHaveBeenCalled();
    expect(book.saveWork).not.toHaveBeenCalled();
    unmount(app);
  });

  it('閉じたときに、まだ保存していない塗りを保存する', async () => {
    const { app, press } = await show();
    await press('りんご');
    unmount(app);
    expect(book.saveWork).toHaveBeenCalled();
  });

  // テンプレートのパスを直しても、保存した作品の場所の番号がずれないよう、作品に保存した線画で場所を分ける
  it('テンプレートの作品は、保存した線画で場所を分ける', async () => {
    const { pack } = await vi.importActual<typeof import('$lib/coloring/book')>('$lib/coloring/book');
    const mask = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) mask[y * SIZE + SIZE / 2] = 1;
    book.works = [{ id: 'w', template: 'apple', lines: pack(mask), colors: {}, history: [], thumb: '', updated: 1 }];
    const { app, target, press } = await show();
    await press('つづきから ぬる');
    expect(target.querySelector('.stub-regions')?.textContent).toBe('2');
    unmount(app);
  });
});
