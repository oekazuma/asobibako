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
    props: { records, onpick: (id) => picked.push(id), onquit: () => {}, onopen: () => {} }
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

  it('選び替えても札の高さが変わらないよう、とくいのない子にも仲間でない子にも同じ行を並べる', () => {
    const { app, tile } = show({ ...emptyRecords(), unlocked: ['dog', 'fox'] });
    const rows = () =>
      [...document.querySelectorAll('.detail .body > *, .detail .info > *')].map((e) => e.className.split(' ')[0]);
    tile('dog').click();
    flushSync();
    const dog = rows();
    expect(dog).toContain('perk');
    tile('fox').click();
    flushSync();
    expect(rows()).toEqual(dog);
    tile('chick').click();
    flushSync();
    expect(rows().filter((r) => r !== 'unlock')).toEqual(dog);
    expect(document.querySelector('.detail .info')!.classList.contains('hide')).toBe(true);
    unmount(app);
  });

  it('クリアした子のタイルに印を付け、札にその子の記録を出す', () => {
    const { app, tile, card } = show({
      ...emptyRecords(),
      unlocked: ['dog', 'cat', 'wolf'],
      clearedBy: ['dog', 'cat'],
      byAnimal: { dog: { time: 600, heat: 3.5 }, wolf: { time: 250 } }
    });
    expect(tile('dog').querySelector('[data-cleared]')).not.toBeNull();
    expect(tile('wolf').querySelector('[data-cleared]')).toBeNull();
    tile('dog').click();
    flushSync();
    expect(card()).toContain('クリア 釜 3.5');
    expect(card()).toContain('10:00');
    tile('cat').click();
    flushSync();
    expect(card()).toContain('クリア済み');
    tile('wolf').click();
    flushSync();
    expect(card()).toContain('最長 04:10');
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
