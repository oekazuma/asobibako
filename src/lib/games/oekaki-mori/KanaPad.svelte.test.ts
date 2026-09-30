import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KanaPad from './KanaPad.svelte';

function show(disabled = false) {
  const onsubmit = vi.fn();
  const ontype = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(KanaPad, { target, props: { disabled, onsubmit, ontype } });
  flushSync();
  const press = (label: string) => {
    const key = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
    if (!key) throw new Error(`no key ${label}`);
    key.click();
    flushSync();
  };
  const typed = () => target.querySelector('.typed')?.textContent;
  return { app, onsubmit, ontype, press, typed };
}

describe('KanaPad', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('押した字をつなげ、゛゜小で最後の字を変え、こたえるで送って空にする', () => {
    const { app, onsubmit, press, typed } = show();
    press('そ');
    press('゛゜小');
    press('う');
    expect(typed()).toBe('ぞう');
    press('こたえる');
    expect(onsubmit).toHaveBeenCalledWith('ぞう');
    expect(typed()).not.toBe('ぞう');
    unmount(app);
  });

  it('空のときの゛゜小と 1じ けす は何もせず、こたえるは送らない', () => {
    const { app, onsubmit, press } = show();
    press('゛゜小');
    press('1じ けす');
    press('こたえる');
    expect(onsubmit).not.toHaveBeenCalled();
    unmount(app);
  });

  it('使えないあいだは送らない', () => {
    const { app, onsubmit, press } = show(true);
    press('い');
    press('こたえる');
    expect(onsubmit).not.toHaveBeenCalled();
    unmount(app);
  });

  it('字が変わるたびに ontype を呼び、こたえると空を知らせる', () => {
    const { app, press, ontype } = show();
    press('い');
    press('ぬ');
    press('こたえる');
    expect(ontype.mock.calls.map((c) => c[0])).toEqual(['い', 'いぬ', '']);
    unmount(app);
  });
});
