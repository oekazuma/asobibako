import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DamageTable from './DamageTable.svelte';
import Pause from './Pause.svelte';
import { emptyRecords } from './records';
import StageSelect from './StageSelect.svelte';
import GrowPlate from './GrowPlate.svelte';
import PromptLayer from './PromptLayer.svelte';
import { Prompts } from './prompts.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

describe('演出の小さい直し', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ヌシの帯が出ているあいだ、ほかの帯は下にずらす', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const prompts = new Prompts(w, false);
    w.events = [{ type: 'rush' }];
    prompts.take();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null, onanswer: () => {} } });
    flushSync();
    expect(target.querySelector('.notice')?.classList.contains('below')).toBe(false);
    w.events = [{ type: 'chief', i: 0, name: 'ヌシイノシシ' }];
    prompts.take();
    flushSync();
    expect(target.querySelector('.notice')?.classList.contains('below')).toBe(true);
    unmount(app);
    prompts.stop();
  });

  it('2 段育ったときの札は、強くなったぶんを 2 段ぶん出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(GrowPlate, { target, props: { from: '子犬', to: '勇者の犬', steps: 2 } });
    flushSync();
    expect(target.textContent).toContain('攻撃 +20%・最大 HP +40');
    unmount(app);
  });
});

describe('画面の小さい直し', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ステージを選ぶ画面はボスの名前を出さない', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const records = { ...emptyRecords(), stages: ['forest', 'graveyard'] };
    const app = mount(StageSelect, { target, props: { records, onpick: () => {}, onback: () => {} } });
    flushSync();
    expect(target.textContent).toContain('ステージを選ぶ');
    for (const name of ['ボス', '巨大ベア', '女王グモ', 'ガイコツの騎士', 'かぼちゃ大王'])
      expect(target.textContent).not.toContain(name);
    unmount(app);
  });

  it('ステージを選ぶ画面に音のボタンがある', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(StageSelect, { target, props: { records: emptyRecords(), onpick: () => {}, onback: () => {} } });
    flushSync();
    expect(target.querySelector('button[aria-label="ミュート"]')).not.toBeNull();
    unmount(app);
  });

  it('一時停止とリザルトの武器の表で、専用進化形は★でなく王冠', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    w.weapons = [{ id: 'woofSp', level: 1, cd: 0 }];
    w.dealt = { woofSp: { damage: 100, kills: 3 } };
    const run = summary(w);
    for (const [c, props] of [
      [Pause, { run, finger: null, onresume: () => {}, onrestart: () => {}, onquit: () => {} }],
      [DamageTable, { run }]
    ] as const) {
      const target = document.body.appendChild(document.createElement('div'));
      // @ts-expect-error 2 つの部品を同じ形で並べて mount する
      const app = mount(c, { target, props });
      flushSync();
      expect(target.querySelector('.crown')).not.toBeNull();
      expect(target.textContent).not.toContain('★');
      unmount(app);
      target.remove();
    }
  });
});
