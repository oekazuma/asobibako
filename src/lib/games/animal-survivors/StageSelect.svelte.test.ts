import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyRecords, record } from './records';
import { createWorld, summary } from './world';
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
    card('graveyard').click();
    expect(picked).toEqual(['graveyard']);
    unmount(app);
  });

  it('釜の強さは 2.0 より上でクリアしたときだけ札に出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const r = {
      ...emptyRecords(),
      stages: ['forest', 'graveyard', 'snow'],
      heat: { forest: 0, graveyard: 2, snow: 2.5 }
    };
    const app = mount(StageSelect, { target, props: { records: r, onpick: () => {}, onback: () => {} } });
    flushSync();
    const text = (id: string) => target.querySelector(`[data-stage="${id}"]`)!.textContent;
    expect(text('forest')).not.toContain('釜');
    expect(text('graveyard')).not.toContain('釜');
    expect(text('snow')).toContain('釜 2.5');
    unmount(app);
  });

  it('0.0 でクリアしたあとに 3.0 でクリアすると、記録は 3.0 になる', () => {
    const r = emptyRecords();
    const run = (level: number) => ({
      ...summary(createWorld('dog', 1, { w: 274, h: 394 })),
      cleared: true,
      heat: { level, bet: 0 }
    });
    record(r, run(0));
    expect(r.heat.forest).toBe(0);
    record(r, run(3));
    expect(r.heat.forest).toBe(3);
  });
});
