<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import { nameOf } from './match.svelte';
  import type { Plate } from './session.svelte';

  let { plates, name = nameOf }: { plates: Plate[]; name?: (seat: Seat) => string } = $props();
</script>

{#each plates as p (p.seat)}
  <span class="plate" style:left="{p.x}px" style:top="{p.y}px">
    {name(p.seat)}
    {#if p.likes}<span class="likes"><Icon name="thumb" size="14px" />{p.likes}</span>{/if}
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

  .likes {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: #ffd23f;
  }
</style>
