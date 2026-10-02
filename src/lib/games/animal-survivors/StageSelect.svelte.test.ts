import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyRecords } from './records';
import StageSelect from './StageSelect.svelte';

function show(stages: string[], stage = 'forest') {
  const picked: string[] = [];
  const r = { ...emptyRecords(), stages, stage };
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(StageSelect, {
    target,
    props: { records: r, onpick: (id: string) => picked.push(id), onback: () => {} }
  });
  flushSync();
  const card = (id: string) => target.querySelector(`[data-stage="${id}"]`) as HTMLButtonElement;
  return { app, picked, card, target };
}

describe('StageSelect', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('森をクリアするまで墓地は押せず、行ける条件を出す', () => {
    const { app, card } = show([]);
    expect(card('forest').disabled).toBe(false);
    expect(card('graveyard').disabled).toBe(true);
    expect(card('graveyard').textContent).toContain('森をクリアすると行ける');
    unmount(app);
  });

  it('森をクリアしたら墓地を選べ、前に遊んだ面に印が付く', () => {
    const { app, card, picked } = show(['forest'], 'graveyard');
    expect(card('graveyard').disabled).toBe(false);
    expect(card('graveyard').getAttribute('aria-current')).toBe('true');
    expect(card('graveyard').textContent).toContain('×1.5');
    expect(card('forest').textContent).toContain('ボス: 巨大ベア・女王グモ');
    expect(card('forest').textContent).not.toContain('女王グモ・巨大ベア');
    card('graveyard').click();
    expect(picked).toEqual(['graveyard']);
    unmount(app);
  });
});
