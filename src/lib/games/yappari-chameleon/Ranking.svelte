<script lang="ts">
  import type { Match } from './match.svelte';

  let { match }: { match: Match } = $props();
</script>

<ol class="ranking" aria-label="順位">
  {#each match.ranking as r, i (r.seat)}
    <li class:me={r.seat === match.me}>
      <span class="num">#{i + 1}</span>
      <span>{match.name(r.seat)}</span>
      <span class="num">{r.got}/{r.need}</span>
    </li>
  {/each}
</ol>

<style>
  .ranking {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 17px;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  li {
    display: flex;
    gap: 10px;
  }

  .me {
    color: #ffd23f;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
