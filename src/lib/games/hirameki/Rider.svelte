<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Crosser } from './types';

  /** small はボートの中。名前を隠して顔だけにする */
  let {
    c,
    small = false,
    ghost = false,
    onpick
  }: { c: Crosser; small?: boolean; ghost?: boolean; onpick: () => void } = $props();
</script>

<button class="rider" class:ghost style:--c={c.color} onclick={onpick} aria-label={c.name} disabled={ghost}>
  <span class="face">
    {#if c.icon}<Icon name={c.icon} size="100%" />{:else}{c.name.slice(0, 1)}{/if}
  </span>
  {#if !small}
    <span class="name">{c.name}{c.time === undefined ? '' : ` ${c.time}分`}</span>
  {/if}
</button>

<style>
  .rider {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px;
    border: none;
    background: none;
    color: var(--line);
    cursor: pointer;
  }

  .ghost {
    visibility: hidden;
  }

  .face {
    display: grid;
    place-items: center;
    width: var(--face);
    height: var(--face);
    padding: 4px;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: var(--c);
    font-size: calc(var(--face) * 0.45);
    font-weight: 800;
  }

  .name {
    font-size: clamp(11px, 2.4cqh, 15px);
    font-weight: 800;
    white-space: nowrap;
  }
</style>
