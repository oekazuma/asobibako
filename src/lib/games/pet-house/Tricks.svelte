<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { kindOf, TRICKS, type Pet } from './engine';
  import type { TrickId } from './types';

  let { pet, ontrick }: { pet: Pet; ontrick: (trick: TrickId) => void } = $props();

  const kind = $derived(kindOf(pet.breed));
</script>

<p class="lead">できたら すぐに なでて ほめてあげよう</p>
<div class="list">
  {#each TRICKS as trick (trick.id)}
    {@const done = pet.tricks[trick.id] ?? 0}
    <button class="pet-choice trick" class:learned={done >= trick.steps} onclick={() => ontrick(trick.id)}>
      <span class="name">{trick[kind]}</span>
      <span class="sr-only">おぼえた ぐあい {Math.min(done, trick.steps)} / {trick.steps}</span>
      <span class="steps">
        {#each { length: trick.steps }, i (i)}
          <span class="step" class:dim={i >= done}><Icon name="star" /></span>
        {/each}
      </span>
      {#if done >= trick.steps}
        <span class="badge"><Icon name="check" />おぼえた</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .lead {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 700;
    text-align: center;
  }

  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .trick {
    position: relative;
  }

  .learned {
    background: #fff4cc;
  }

  .name {
    font-size: 19px;
  }

  .steps {
    display: flex;
    gap: 2px;
    font-size: 16px;
  }

  .dim {
    opacity: 0.25;
    filter: grayscale(1);
  }

  .badge {
    position: absolute;
    top: -10px;
    right: -6px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px 2px 4px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-gold);
    font-size: 12px;
  }
</style>
