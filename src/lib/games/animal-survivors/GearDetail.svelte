<script lang="ts">
  import { SELL } from './gacha';
  import { fxText, parseKey, RARITY_NAME, SLOT_NAME, statText, type GearKey } from './gear';
  import GearIcon from './GearIcon.svelte';

  let {
    gear,
    count,
    worn,
    onact
  }: { gear: GearKey; count: number; worn: boolean; onact: (what: 'equip' | 'merge' | 'sell' | 'close') => void } =
    $props();

  const p = $derived(parseKey(gear)!);
  /** 売るのは取り消せないので、同じ品で 2 回押して売る */
  let sure = $state<GearKey | null>(null);
  const fx = $derived(fxText(p.def, p.rarity));
</script>

<section class="as-card detail" aria-label="装備の詳しい札">
  <div class="head">
    <GearIcon {gear} size="min(12cqw, 7cqh, 60px)" />
    <span class="body">
      <b>{p.def.name}</b>
      <span class="rar r{p.rarity}">{RARITY_NAME[p.rarity]}・{SLOT_NAME[p.def.slot]}・{count} こ</span>
      <span>{statText(p.def, p.rarity)}</span>
      {#if fx}<span class="fx">{fx}</span>{:else}<span class="dim">レア以上は特別な効き目を持つ</span>{/if}
    </span>
  </div>
  <div class="acts">
    <button class="as-card" disabled={worn} onclick={() => onact('equip')}>{worn ? 'つけている' : 'つける'}</button>
    <button class="as-card" disabled={p.rarity === 2 || count < 3} onclick={() => onact('merge')}
      >合成（3 こで 1 段上）</button
    >
    <button class="as-card" onclick={() => (sure === gear ? onact('sell') : (sure = gear))}
      >{sure === gear ? '本当に売る' : '売る'}（{SELL[p.rarity]} コイン）</button
    >
    <button class="as-card" onclick={() => onact('close')}>とじる</button>
  </div>
</section>

<style>
  .detail {
    display: grid;
    gap: 8px;
    cursor: default;
  }

  .head {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .body {
    display: grid;
    gap: 2px;
    font-size: min(3.2cqw, 1.9cqh, 16px);
  }

  b {
    font-size: 1.25em;
  }

  .rar {
    color: #5d3a2a;
  }

  .r1 {
    color: #2a64c8;
  }

  .r2 {
    color: #c07a0c;
  }

  .fx {
    color: #a3501c;
    font-weight: 700;
  }

  .dim {
    color: #9aa0ae;
  }

  .acts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .acts button {
    justify-content: center;
    font-size: min(3cqw, 1.8cqh, 15px);
  }

  .acts button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
