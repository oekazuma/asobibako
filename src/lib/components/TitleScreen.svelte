<script lang="ts">
  import type { Component } from 'svelte';
  import type { Player } from '$lib/player';

  let {
    name,
    Howto,
    ready,
    onpaddown,
    onpadup
  }: {
    name: string;
    Howto: Component;
    ready: Record<Player, boolean>;
    onpaddown: (event: PointerEvent, player: Player) => void;
    onpadup: (event: PointerEvent, player: Player) => void;
  } = $props();
</script>

{#snippet face(player: Player)}
  <span class="tag p{player}">{player}P</span>
  <!-- 向かい側は手前側を 180 度回した写しなので、見出しとして数えるのは手前側だけ -->
  <svelte:element this={player === 1 ? 'h1' : 'span'} class="title sticker">{name}</svelte:element>
  <Howto />
  <span class="pill p{player} cta">{ready[player] ? 'あいてを まってるよ…' : '長押しで スタート'}</span>
{/snippet}

{#each [2, 1] as const as player (player)}
  <button
    class="half p{player}"
    class:armed={ready[player]}
    onpointerdown={(e) => onpaddown(e, player)}
    onpointerup={(e) => onpadup(e, player)}
    onpointercancel={(e) => onpadup(e, player)}
  >
    {@render face(player)}
  </button>
{/each}

<style>
  /* 自分の陣地を、自分の色の水玉で塗る */
  .half.p1 {
    background: var(--dots), linear-gradient(to bottom, #fff, var(--p1-soft) 60%);
  }

  .half.p2 {
    background: var(--dots), linear-gradient(to bottom, #fff, var(--p2-soft) 60%);
  }

  .half.p1.armed {
    background: var(--p1-soft);
    box-shadow: inset 0 0 0 6px var(--p1);
  }

  .half.p2.armed {
    background: var(--p2-soft);
    box-shadow: inset 0 0 0 6px var(--p2);
  }

  .tag {
    padding: 4px 14px;
    border: 3px solid #fff;
    border-radius: 999px;
    color: #fff;
    font-size: clamp(13px, 2dvh, 17px);
    font-weight: 800;
    letter-spacing: 0.1em;
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
  }

  .tag.p1 {
    background: var(--p1);
  }

  .tag.p2 {
    background: var(--p2);
  }

  .title {
    font-size: clamp(30px, 6dvh, 56px);
  }

  .cta {
    margin-top: clamp(4px, 1dvh, 12px);
    font-size: clamp(15px, 2.3dvh, 20px);
    animation: bob 1.6s ease-in-out infinite;
  }

  .armed .cta {
    animation: none;
    translate: 0 4px;
    box-shadow: 0 2px 0 var(--edge);
  }

  @keyframes bob {
    50% {
      scale: 1.05;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta {
      animation: none;
    }
  }
</style>
