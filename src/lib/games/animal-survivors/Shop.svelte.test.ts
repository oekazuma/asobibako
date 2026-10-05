import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RECORDS_KEY, emptyRecords, loadRecords } from './records';
import Shop from './Shop.svelte';
import { UPGRADES } from './upgrades';

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Shop, { target, props: { onback: () => {} } });
  flushSync();
  const card = (id: string) => target.querySelector(`[data-upgrade="${id}"]`) as HTMLButtonElement;
  return { target, app, card };
}

describe('Shop', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => (document.body.innerHTML = ''));

  it('買うとコインが減って段が上がり、保存され、はじめての買い物の実績が入る', () => {
    const r = emptyRecords();
    r.coins = UPGRADES[0].base;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
    const { target, app, card } = show();
    card('might').click();
    flushSync();
    const saved = loadRecords();
    expect(saved.ranks.might).toBe(1);
    expect(saved.achieved).toContain('firstBuy');
    expect(saved.coins).toBe(20);
    expect(target.textContent).toContain('はじめてのパワーアップ');
    unmount(app);
  });

  it('足りない品は押せず、あといくら足りないかを出し、最大の品は MAX', () => {
    const r = emptyRecords();
    r.coins = 50;
    r.ranks.revive = 1;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
    const { app, card, target } = show();
    const might = UPGRADES.find((d) => d.id === 'might')!;
    expect(card('might').disabled).toBe(true);
    expect(card('might').textContent).toContain(`あと ${(might.base - 50).toLocaleString('ja-JP')}`);
    expect(card('revive').disabled).toBe(true);
    expect(card('revive').classList.contains('full')).toBe(true);
    expect(card('revive').textContent).toContain('MAX');
    expect(target.querySelector('.purse')!.classList.contains('stick')).toBe(true);
    unmount(app);
  });
});
