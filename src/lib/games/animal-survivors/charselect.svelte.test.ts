import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANIMALS, type AnimalId } from './animals';
import CharSelect from './CharSelect.svelte';
import { emptyRecords, parseRecords, record } from './records';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

function show(records = emptyRecords()) {
  const picked: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(CharSelect, {
    target,
    props: { records, onpick: (id) => picked.push(id), onquit: () => {}, onopen: () => {}, onrepeat: () => {} }
  });
  flushSync();
  const tile = (id: string) => target.querySelector(`[data-animal="${id}"]`) as HTMLButtonElement;
  const go = () => target.querySelector('[data-go]') as HTMLButtonElement;
  const card = () => target.querySelector('.detail')!.textContent ?? '';
  return { app, picked, tile, go, card };
}

describe('キャラ選択', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('10 匹の顔のタイルが並び、押すと選ぶだけで、出発のボタンで進む', () => {
    const { app, picked, tile, go, card } = show();
    expect(document.querySelectorAll('[data-animal]')).toHaveLength(ANIMALS.length);
    tile('cat').click();
    flushSync();
    expect(picked).toEqual([]);
    expect(card()).toContain('猫');
    expect(card()).toContain('ネコパンチ');
    go().click();
    expect(picked).toEqual(['cat']);
    unmount(app);
  });

  it('まだ仲間でない子を選ぶと、仲間になる条件を出して出発できない', () => {
    const { app, tile, go, card } = show();
    tile('chick').click();
    flushSync();
    expect(card()).toContain('？？？');
    expect(card()).toContain('火山をクリアすると仲間になる');
    expect(go().disabled).toBe(true);
    unmount(app);
  });

  it('最後に遊んだ動物を選んだ状態で開く', () => {
    const r = { ...emptyRecords(), unlocked: ['dog', 'cat', 'wolf', 'fox'] as AnimalId[], animal: 'fox' as const };
    const { app, picked, go } = show(r);
    go().click();
    expect(picked).toEqual(['fox']);
    unmount(app);
  });
});

describe('最後に遊んだ動物の記録', () => {
  it('回を記録すると覚え、古い記録や知らない id は犬で読む', () => {
    const r = emptyRecords();
    expect(r.animal).toBe('dog');
    record(r, summary(createWorld('wolf', 1, { w: 274, h: 394 })));
    expect(r.animal).toBe('wolf');
    expect(parseRecords(JSON.stringify({ coins: 1 })).animal).toBe('dog');
    expect(parseRecords(JSON.stringify({ animal: 'nope' })).animal).toBe('dog');
  });
});
