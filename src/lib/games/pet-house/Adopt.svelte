<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { BREEDS } from './breeds';
  import type { BreedId } from './types';

  let {
    breed,
    price,
    onname,
    onback
  }: {
    breed: BreedId;
    price: number;
    onname: (name: string) => void;
    onback: () => void;
  } = $props();

  let name = $state('');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim()) onname(name.trim());
  }
</script>

<form class="naming" onsubmit={submit}>
  <h2 class="yuru">なまえを つけてね</h2>
  <div class="names">
    {#each BREEDS[breed].names as n (n)}
      <button type="button" class="pill" class:gold={name === n} onclick={() => (name = n)}>{n}</button>
    {/each}
  </div>
  <input bind:value={name} maxlength="8" placeholder="じぶんで いれる" aria-label="なまえ" autocomplete="off" />
  <div class="actions">
    <button type="button" class="pill" onclick={onback}>もどる</button>
    <button type="submit" class="pill p2" disabled={!name.trim()}>
      むかえる{#if price > 0}<Icon name="coin" />{price}{/if}
    </button>
  </div>
</form>

<style>
  .naming {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 1.6cqh, 16px);
  }

  h2 {
    --fill: var(--pastel-gold);
    font-size: clamp(20px, min(3.4cqh, 7cqw), 34px);
    white-space: nowrap;
  }

  .names {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .names .pill {
    padding: 6px 16px;
    font-size: 17px;
  }

  input {
    width: min(100%, 300px);
    padding: 10px 18px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    /* 16px より小さいと iOS がフォーカス時に拡大する */
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    text-align: center;
    touch-action: manipulation;
    user-select: text;
    -webkit-user-select: text;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .pill:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: default;
  }
</style>
