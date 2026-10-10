import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import Plates from './Plates.svelte';

describe('Plates', () => {
  it('名前の札に、ええやんを受けた数があれば親指と数を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Plates, {
      target,
      props: {
        plates: [
          { seat: 1, x: 10, y: 20, likes: 2 },
          { seat: 2, x: 30, y: 20, likes: 0 }
        ]
      }
    });
    flushSync();
    const [one, two] = target.querySelectorAll('.plate');
    expect(one.textContent).toContain('プレイヤー1');
    expect(one.querySelector('.likes')?.textContent).toBe('2');
    expect(one.querySelector('.likes svg')).not.toBeNull();
    expect(two.querySelector('.likes')).toBeNull();
    unmount(app);
  });

  it('名前を渡せば、その名前で札を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Plates, {
      target,
      props: { plates: [{ seat: 2, x: 0, y: 0, likes: 0 }], name: (seat: number) => `CPU ${seat - 1}` }
    });
    flushSync();
    expect(target.querySelector('.plate')?.textContent).toContain('CPU 1');
    unmount(app);
  });
});
