<script lang="ts">
  import { nameOf } from './match.svelte';
  import type { Plate } from './session.svelte';

  let { plates }: { plates: Plate[] } = $props();
</script>

{#each plates as p (p.seat)}
  <span class="plate" style:left="{p.x}px" style:top="{p.y}px">
    {nameOf(p.seat)}
  </span>
{/each}

<style>
  .plate {
    position: absolute;
    translate: -50% -100%;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 14px;
    white-space: nowrap;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }
</style>
