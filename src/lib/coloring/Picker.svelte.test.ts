import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Work } from './book';
import Picker from './Picker.svelte';

const work: Work = {
  id: 'w1',
  template: 'apple',
  colors: {},
  history: [],
  thumb: 'data:image/png;base64,',
  updated: 1
};

function show(extra: { dropped?: number } = {}) {
  const props = { works: [work], ontemplate: vi.fn(), onwork: vi.fn(), onphoto: vi.fn(), onremove: vi.fn(), ...extra };
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Picker, { target, props });
  flushSync();
  const button = (label: string) =>
    [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label
    )!;
  return { app, props, button };
}

describe('Picker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ぬりえちょうに、いくつ入っているかと上限を出す', () => {
    const { app } = show();
    expect(document.body.textContent).toContain('1 / 30');
    unmount(app);
  });

  it('古い作品を消したときだけ、そのことを知らせる', () => {
    const quiet = show();
    expect(document.body.querySelector('[role="status"]')).toBeNull();
    unmount(quiet.app);
    document.body.innerHTML = '';
    const { app } = show({ dropped: 1 });
    expect(document.body.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'いちばん ふるい さくひんを けしたよ'
    );
    unmount(app);
  });

  it('テンプレートを押すとそのテンプレートで始める', () => {
    const { app, props, button } = show();
    button('りんご').click();
    expect(props.ontemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'apple' }));
    unmount(app);
  });

  it('作品は、ふだんは続きを開き、「けす」を押したあとは消す', () => {
    const { app, props, button } = show();
    button('つづきから ぬる').click();
    expect(props.onwork).toHaveBeenCalledWith(work);
    button('けす').click();
    flushSync();
    button('この さくひんを けす').click();
    expect(props.onremove).toHaveBeenCalledWith(work);
    unmount(app);
  });
});
