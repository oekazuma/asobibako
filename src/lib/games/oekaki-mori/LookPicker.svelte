<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { LOOKS, type Look } from './looks';

  let { look, onlook }: { look?: string; onlook: (look: Look) => void } = $props();
</script>

<div class="looks" role="group" aria-label="あなたの どうぶつ">
  {#each LOOKS as l (l.id)}
    <button class="look" aria-pressed={look === l.id} aria-label={l.name} onclick={() => onlook(l.id)}>
      <Icon name={l.id} size="34px" />
    </button>
  {/each}
</div>

<style>
  .looks {
    display: grid;
    grid-template-columns: repeat(4, 52px);
    gap: 8px;
  }

  .look {
    display: grid;
    place-items: center;
    height: 52px;
    border: 2px solid var(--line);
    border-radius: 14px;
    background: #fff;
    cursor: pointer;
  }

  .look[aria-pressed='true'] {
    background: var(--pastel-gold);
    outline: 3px solid var(--line);
  }
</style>
