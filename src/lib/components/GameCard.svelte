<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import type { GameMeta } from '$lib/games';
  import { savedLevel } from '$lib/levels';

  let { game }: { game: GameMeta } = $props();

  /** 到達レベル。プリレンダーでは分からないので mount 後に読む */
  let reached = $state<number | null>(null);
  onMount(() => {
    if (game.players === 1) reached = savedLevel(game.id, game.levels);
  });
</script>

<a class="card" href={resolve('/games/[id]', { id: game.id })}>
  <div class="thumb"><game.Thumb /></div>
  <div class="body">
    <h3>{game.name}</h3>
    <p class="desc">{game.description}</p>
    <p class="meta">
      <span class="chip">{game.players}人</span>
      <span class="chip">{game.minutes}</span>
      {#if reached !== null && reached > 1}
        {@const done = game.players === 1 && reached > game.levels}
        <span class="chip reached" class:done>
          {done ? 'ぜんぶクリア' : `レベル ${reached}`}
        </span>
      {/if}
    </p>
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border: 4px solid #fff;
    border-radius: 26px;
    background: var(--card);
    box-shadow:
      0 8px 0 var(--card-edge),
      0 16px 28px rgb(43 45 66 / 0.1);
    color: inherit;
    text-decoration: none;
    transition:
      translate 90ms,
      box-shadow 90ms;
  }

  .card:active {
    translate: 0 6px;
    box-shadow:
      0 2px 0 var(--card-edge),
      0 6px 14px rgb(43 45 66 / 0.1);
  }

  .thumb {
    display: block;
    height: 128px;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    padding: 14px 18px 18px;
  }

  .body h3 {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .desc {
    color: var(--ink-soft);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.6;
  }

  .meta {
    display: flex;
    gap: 6px;
    margin-top: auto;
    padding-top: 4px;
  }

  .chip {
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bg);
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 800;
  }

  .chip.reached {
    background: var(--p1-soft);
    color: var(--p1-deep);
  }

  .chip.done {
    background: var(--gold);
    color: var(--ink);
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
  }
</style>
