<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { SHOP } from './engine';
  import type { FoodId, Kind } from './types';

  let {
    food,
    kind,
    onfeed,
    onwater
  }: {
    food: Record<FoodId, number>;
    kind: Kind;
    onfeed: (food: FoodId) => void;
    onwater: () => void;
  } = $props();

  const foods = $derived(SHOP.filter((i) => i.type === 'food' && (!i.kind || i.kind === kind)));
</script>

<div class="grid">
  {#each foods as item (item.id)}
    {@const left = food[item.id as FoodId]}
    <button class="pet-choice" disabled={left <= 0} onclick={() => onfeed(item.id as FoodId)}>
      <Icon name={item.id === 'treat' ? 'meat' : 'bowl'} size="44px" />
      <span class="name">{item.name}</span>
      <span class="count">{left > 0 ? `のこり ${left}` : 'おみせで かえるよ'}</span>
    </button>
  {/each}
  <button class="pet-choice water" onclick={onwater}>
    <Icon name="drop" size="44px" />
    <span class="name">おみず</span>
    <span class="count">いくらでも</span>
  </button>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
  }

  .water {
    background: var(--pastel-p1);
  }

  .name {
    font-size: 17px;
  }

  .count {
    color: var(--line-soft);
    font-size: 13px;
  }
</style>
