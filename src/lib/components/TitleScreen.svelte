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
  <!-- 向かい側は手前側を 180 度回した写しなので、見出しとして数えるのは手前側だけ -->
  <svelte:element this={player === 1 ? 'h1' : 'span'} class="title">{name}</svelte:element>
  <Howto />
  <span class="cta">{ready[player] ? '相手を待っています…' : '長押しでスタート'}</span>
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
  .half.p1.armed {
    background: var(--zone-1);
  }

  .half.p2.armed {
    background: var(--zone-2);
  }

  .title {
    font-size: clamp(26px, 5dvh, 46px);
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .cta {
    margin-top: clamp(4px, 1dvh, 12px);
    padding: 10px 22px;
    border: 1px solid #39404f;
    border-radius: 999px;
    font-size: clamp(13px, 2dvh, 18px);
  }
</style>
