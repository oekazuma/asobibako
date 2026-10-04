<script lang="ts">
  import { parseKey, RARITY_NAME, type GearKey } from './gear';
  import GearIcon from './GearIcon.svelte';

  /** 引いた品の並び（10 連の結果と、3D が使えないときの代わり） */
  let { gears }: { gears: GearKey[] } = $props();

  /** 同じ品が 2 つ出ることがあるので、引いた順の番号も付けて見分ける */
  const items = $derived(gears.map((g, i) => ({ g, i, id: `${i}:${g}` })));
</script>

<ul class="list" class:one={gears.length === 1} aria-label="引いた品">
  {#each items as { g, i, id } (id)}
    {@const p = parseKey(g)}
    {#if p}
      <li data-got class="r{p.rarity}" style:--d="{i * 0.05}s">
        <GearIcon gear={g} size={gears.length === 1 ? 'min(18cqw, 10cqh, 96px)' : 'min(9cqw, 5cqh, 44px)'} />
        <small class="rar">{RARITY_NAME[p.rarity]}</small>
        <span>{p.def.name}</span>
      </li>
    {/if}
  {/each}
</ul>

<style>
  .list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px 6px;
    margin: 0;
    padding: 0 12px;
    list-style: none;
  }

  .one {
    grid-template-columns: 1fr;
  }

  li {
    display: grid;
    gap: 2px;
    justify-items: center;
    color: #fff8ec;
    font-size: min(2.6cqw, 1.5cqh, 13px);
    font-weight: 700;
    text-align: center;
    animation: pop 300ms var(--d) var(--spring, ease-out) both;
  }

  .one li {
    font-size: min(4.6cqw, 2.7cqh, 24px);
  }

  .rar {
    font-size: 0.85em;
  }

  .r1 .rar {
    color: #5ab0ff;
  }

  .r2 .rar {
    color: #ffd84a;
  }

  @keyframes pop {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    li {
      animation: none;
    }
  }
</style>
