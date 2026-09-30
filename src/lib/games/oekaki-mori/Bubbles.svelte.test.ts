import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Bubbles from './Bubbles.svelte';

describe('Bubbles', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('答えはかぎかっこで囲み、お知らせ（じかんぎれ）は囲まない', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Bubbles, {
      target,
      props: {
        bubbles: [
          { id: 1, seat: 2, text: 'ねこ' },
          { id: 2, seat: 3, text: 'じかんぎれ', note: true }
        ]
      }
    });
    flushSync();
    expect([...target.querySelectorAll('.bubble')].map((b) => b.textContent)).toEqual(['2P「ねこ」', '3P じかんぎれ']);
    unmount(app);
  });
});
