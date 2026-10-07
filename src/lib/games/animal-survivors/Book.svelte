<script lang="ts">
  import Back from './Back.svelte';
  import { entries, type Entry, type Tab } from './book-view';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';

  let { records, onback }: { records: Records; onback: () => void } = $props();

  const TABS: [Tab, string][] = [
    ['enemies', '敵'],
    ['bosses', 'ボス'],
    ['forms', '動物'],
    ['items', '品'],
    ['arcana', '札'],
    ['relics', '遺物']
  ];
  let tab = $state<Tab>('enemies');
  let open = $state<Entry | null>(null);
  const list = $derived(entries(records, tab));
  const known = $derived(list.filter((e) => e.known).length);

  function choose(t: Tab) {
    tab = t;
    open = null;
  }
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="図鑑">
    <h2 class="as-title">図鑑</h2>
    <div class="tabs" role="tablist">
      {#each TABS as [t, label] (t)}
        <button class="as-card tab" class:on={tab === t} role="tab" aria-selected={tab === t} onclick={() => choose(t)}
          >{label}</button
        >
      {/each}
    </div>
    <p class="count">{known} / {list.length}</p>
    <div class="grid">
      {#each list as e (e.key)}
        <button
          class="book-card"
          class:unknown={!e.known}
          class:on={open?.key === e.key}
          aria-label={e.known ? e.name : '？？？'}
          onclick={() => (open = e)}
        >
          <PixelIcon art={e.art} size="min(11cqw, 6.4cqh, 60px)" />
        </button>
      {/each}
    </div>
    <div class="detail" aria-live="polite">
      {#if open}
        <b>{open.known ? open.name : '？？？'}</b>
        {#if open.known}
          {#each open.detail as line (line)}<span>{line}</span>{/each}
        {:else}
          <span>{open.hint ?? 'まだ載っていない'}</span>
        {/if}
      {:else}
        <span>札を押すと、くわしく見られる</span>
      {/if}
    </div>
  </section>
</div>
<Back {onback} />

<style>
  .tabs {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 6px;
  }

  .tab {
    justify-content: center;
    padding-inline: 4px;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .tab.on {
    background: #ffd84a;
  }

  .count {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(15cqw, 9cqh, 78px), 1fr));
    gap: 6px;
  }

  .book-card {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 4px;
    border: 2px solid #4a3a6a;
    background: #1f1530;
    cursor: pointer;
  }

  .book-card.on {
    border-color: #ffd84a;
  }

  /* まだ載っていないものは黒い影だけを見せる */
  .unknown :global(*) {
    filter: brightness(0);
    opacity: 0.6;
  }

  .detail {
    display: grid;
    gap: 4px;
    min-height: 4.6em;
    padding: 8px 12px;
    background: #1f1530;
    color: #d8d0e8;
    font-size: min(3.8cqw, 2.2cqh, 18px);
  }

  .detail b {
    color: #ffd84a;
    font-size: 1.2em;
  }
</style>
