<script lang="ts">
  import type { Match } from './match.svelte';

  let { match }: { match: Match } = $props();
</script>

<section class="spotted" aria-label="見落とされた場所">
  <h2>見落とされた場所</h2>
  <ol>
    {#each match.spotted as r, i (r.seat)}
      <li>
        <span class="num">{i + 1}</span>
        <span>{match.name(r.seat)}</span>
        <span class="num">{r.pts}</span>
        {#if r.place}<span class="place">{r.place}</span>{/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .spotted {
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  h2 {
    margin: 0 0 2px;
    font-size: 18px;
    font-weight: normal;
  }

  ol {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 10px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .place {
    color: #ffd23f;
  }
</style>
