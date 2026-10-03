<script lang="ts">
  import { ARCANA_ART } from './art/arcana';
  import { arcanaDef, type ArcanaId } from './arcana';
  import PixelIcon from './PixelIcon.svelte';

  let { cards }: { cards: ArcanaId[] } = $props();
</script>

{#if cards.length}
  <ul class="row" aria-label="持っている札">
    {#each cards as id (id)}
      <li><PixelIcon art={ARCANA_ART[id]} size="min(5cqw, 3cqh, 28px)" />{arcanaDef(id).name}</li>
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
</style>
