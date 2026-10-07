import { describe, expect, it } from 'vitest';
import { RAISE_BLESS } from './heroes';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

describe('復活の帯', () => {
  it('raised で、起こした側にも起きた側にも「復活！」とご利益の帯が出る', () => {
    for (const cur of [0, 1]) {
      const w = createWorld('dog', 1, { w: 260, h: 380 });
      addHero(w, 'cat');
      w.cur = cur;
      const p = new Prompts(w);
      w.events.push({ type: 'raised', who: 1, by: 0 });
      p.take();
      expect(p.notice?.text).toContain('復活！');
      expect(p.notice?.text).toContain(`${RAISE_BLESS} 秒`);
    }
  });
});
