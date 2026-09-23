<script lang="ts">
  import { onMount } from 'svelte';
  import { asset, resolve } from '$app/paths';
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
  <div class="frame">
    <img
      class="thumb"
      src={asset(`/thumbs/${game.id}.webp`)}
      alt=""
      width="680"
      height="400"
      loading="eager"
      decoding="async"
    />
    {#if reached !== null && reached > 1}
      {@const done = game.players === 1 && reached > game.levels}
      <span class="reached" class:done>{done ? 'ぜんぶクリア' : `Lv ${reached}`}</span>
    {/if}
  </div>
  <h3>{game.name}</h3>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
    border: 4px solid #fff;
    border-radius: 22px;
    background: var(--card);
    box-shadow:
      0 6px 0 var(--card-edge),
      0 12px 22px rgb(43 45 66 / 0.1);
    color: inherit;
    text-decoration: none;
    transition:
      translate 90ms,
      box-shadow 90ms;
  }

  .card:active {
    translate: 0 4px;
    box-shadow:
      0 2px 0 var(--card-edge),
      0 6px 14px rgb(43 45 66 / 0.1);
  }

  .frame {
    position: relative;
  }

  .thumb {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 680 / 400;
    border-radius: 18px 18px 0 0;
    object-fit: cover;
  }

  .reached {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 0.15em 0.8em;
    border: 2px solid #fff;
    border-radius: 999px;
    background: var(--p1);
    color: #fff;
    font-size: clamp(9px, 6cqi, 12px);
    white-space: nowrap;
    font-weight: 800;
    box-shadow: 0 2px 0 var(--p1-deep);
  }

  .reached.done {
    background: var(--gold);
    color: var(--ink);
    box-shadow: 0 2px 0 var(--gold-deep);
  }

  /* スマホの最近の段では 3 枚を 1 行に詰めるので、文字はタイルの幅に合わせて縮める */
  h3 {
    padding: 8px 4px 10px;
    font-size: clamp(11px, 8cqi, 20px);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
  }
</style>
