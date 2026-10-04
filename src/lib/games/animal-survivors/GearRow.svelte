<script lang="ts">
  import { parseKey, RARITY_NAME, type GearKey } from './gear';
  import GearIcon from './GearIcon.svelte';

  /** named で名前とレア度も出す（一時停止。リザルトはアイコンだけ） */
  let { keys, named = false }: { keys: GearKey[]; named?: boolean } = $props();
</script>

{#if keys.length}
  <ul class="row" aria-label="つけている装備">
    {#each keys as k (k)}
      {@const p = parseKey(k)}
      {#if p}
        <li>
          <GearIcon gear={k} size="min(4.4cqw, 2.6cqh, 24px)" />
          {#if named}<span class="text">{p.def.name}<small>{RARITY_NAME[p.rarity]}</small></span>{/if}
        </li>
      {/if}
    {/each}
  </ul>
{/if}

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #fff8ec;
    font-size: min(3cqw, 1.8cqh, 15px);
    font-weight: 700;
  }

  .text {
    display: grid;
  }

  small {
    color: #bcc4ce;
    font-size: 0.8em;
  }
</style>
