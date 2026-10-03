import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DamageTable from './DamageTable.svelte';
import type { RunSummary } from './world';

const run: RunSummary = {
  animal: 'dog',
  cleared: false,
  time: 300,
  level: 10,
  kills: 50,
  xp: 0,
  weapons: [
    { id: 'woofEvo', level: 5 },
    { id: 'paw', level: 3 }
  ],
  passives: [{ id: 'fang', level: 2 }],
  bosses: [],
  coins: 0,
  opened: 0,
  evolved: ['woofEvo'],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  dealt: [
    { id: 'woofEvo', damage: 1200, kills: 40 },
    { id: 'paw', damage: 300, kills: 10 },
    { id: 'woof', damage: 100, kills: 3 }
  ]
};

describe('DamageTable', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('武器ごとに名前・Lv（進化形は ★）・ダメージ・倒した数を、多い順に出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(DamageTable, { target, props: { run } });
    flushSync();
    const rows = [...target.querySelectorAll('.row:not(.head)')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('ホネのあられ');
    expect(rows[0]).toContain('★');
    expect(rows[0]).toContain('1,200');
    expect(rows[1]).toContain('Lv3');
    // 進化前の武器は持ち物に残らないが、Lv5 で進化したので Lv5 と出す
    expect(rows[2]).toContain('Lv5');
    unmount(app);
  });
});
