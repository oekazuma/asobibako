<script lang="ts">
  import { ARCANA_ART } from './art/arcana';
  import { arcanaDef, type ArcanaId } from './arcana';
  import PixelIcon from './PixelIcon.svelte';

  /** detail で良いところと悪いところも出す（一時停止。リザルトは名前だけ） */
  let { cards, detail = false }: { cards: ArcanaId[]; detail?: boolean } = $props();
</script>

{#if cards.length}
  <ul class="row" aria-label="持っている札">
    {#each cards as id (id)}
      {@const d = arcanaDef(id)}
      <li class:detail>
        <PixelIcon art={ARCANA_ART[id]} size="min(5cqw, 3cqh, 28px)" />
        <span class="text">
          {d.name}
          {#if detail}<small>{d.good}</small>{#if d.bad}<small class="bad">ただし {d.bad}</small>{/if}{/if}
        </span>
      </li>
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
    font-size: min(3.6cqw, 2.2cqh, 18px);
  }

  li {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  li.detail {
    flex-basis: 100%;
  }

  .text {
    display: grid;
    text-align: left;
  }

  small {
    color: #c9b8a0;
    font-size: 0.8em;
  }

  .bad {
    color: #ff8a7a;
  }
</style>
