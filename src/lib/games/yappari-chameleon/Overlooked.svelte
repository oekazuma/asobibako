<script lang="ts">
  import type { Match } from './match.svelte';

  let { match }: { match: Match } = $props();
  let folded = $state(false);
</script>

<!-- スティックの指を置いたまま押すので、pointerdown で受ける -->
{#if folded}
  <button class="toggle" onpointerdown={() => (folded = false)}>見落とした敵</button>
{:else}
  <section class="overlooked" aria-label="見落とした敵">
    <header>
      <h2>見落とした敵</h2>
      <button class="toggle" onpointerdown={() => (folded = true)}>隠す</button>
    </header>
    {#each match.overlooked as r (r.seat)}
      <p><span>{match.name(r.seat)}</span><span class="pts">{r.pts}</span></p>
    {/each}
  </section>
{/if}

<style>
  .overlooked {
    display: grid;
    gap: 2px;
    min-width: 170px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: normal;
  }

  p {
    display: flex;
    justify-content: space-between;
    margin: 0;
  }

  .pts {
    font-variant-numeric: tabular-nums;
  }

  /* 親の .side は指を受けないので、押せる部品だけ自分で戻す */
  .toggle {
    padding: 2px 12px;
    border: 1px solid rgb(255 255 255 / 0.8);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 14px;
    pointer-events: auto;
  }
</style>
