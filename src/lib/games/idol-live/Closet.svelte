<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import { need, NAMES, owned, SLOTS, THEME_ORDER, THEMES, type Coord, type Slot, type Theme } from './outfits';

  /** 衣装を部位ごとのタブから選ぶ。まだ持っていない服は、あと何人のファンで手に入るかを見せる */
  let {
    coord,
    fans,
    match,
    onwear
  }: { coord: Coord; fans: number; match: Theme; onwear: (slot: Slot, theme: Theme) => void } = $props();

  let tab = $state<Slot>('top');
  const MARK: Record<Theme, IconName> = { cute: 'heart', cool: 'bolt', pop: 'star', elegant: 'ribbon' };
</script>

<div class="closet">
  <div class="tabs">
    {#each SLOTS as s (s.id)}
      <button class="tab" aria-pressed={tab === s.id} onclick={() => (tab = s.id)}>
        {s.name}
        {#if coord[s.id] === match}<span class="dot"><span class="sr-only">きょくと おなじ テーマ</span></span>{/if}
      </button>
    {/each}
  </div>
  <div class="items">
    {#each THEME_ORDER as th (th)}
      {@const ok = owned(th, tab, fans)}
      <button
        class="item"
        style:--c={THEMES[th].color}
        aria-pressed={coord[tab] === th}
        disabled={!ok}
        onclick={() => onwear(tab, th)}
      >
        <span class="mark"><Icon name={MARK[th]} size="1.4em" /></span>
        <span class="text">
          <span class="theme">{THEMES[th].name}</span>
          <span class="name">{ok ? NAMES[th][tab] : `ファン ${need(th, tab)}にんで`}</span>
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .closet {
    display: grid;
    gap: 8px;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .tab {
    position: relative;
    padding: 8px 0;
    border: 3px solid var(--line);
    border-radius: 14px 14px 6px 6px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
    font-size: clamp(13px, min(1.9cqh, 3.6cqw), 20px);
  }

  .tab[aria-pressed='true'] {
    background: var(--pastel-p2);
  }

  .dot {
    position: absolute;
    top: -6px;
    right: -4px;
    width: 14px;
    height: 14px;
    border: 2px solid var(--line);
    border-radius: 50%;
    background: var(--pastel-gold);
  }

  .items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #fff;
    box-shadow: var(--soft-shadow);
    color: var(--line);
    text-align: left;
    font-size: clamp(12px, min(1.7cqh, 3.3cqw), 18px);
  }

  .item[aria-pressed='true'] {
    background: color-mix(in srgb, var(--c) 28%, #fff);
    outline: 4px solid var(--c);
  }

  .item:disabled {
    opacity: 0.55;
    filter: grayscale(0.7);
  }

  .mark {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.2em;
    height: 2.2em;
    border-radius: 50%;
    background: color-mix(in srgb, var(--c) 30%, #fff);
  }

  .text {
    display: grid;
  }

  .theme {
    color: var(--c);
    font-weight: 800;
    font-size: 0.8em;
  }

  .name {
    font-weight: 800;
  }
</style>
