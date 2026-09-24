<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import { BREEDS } from './breeds';
  import { hearts, LOW, type Pet } from './engine';
  import type { Stat } from './types';

  let { pet, money }: { pet: Pet; money: number } = $props();

  const METERS: { id: Stat; name: string; icon: IconName }[] = [
    { id: 'food', name: 'おなか', icon: 'bowl' },
    { id: 'water', name: 'のど', icon: 'drop' },
    { id: 'clean', name: 'きれい', icon: 'brush' },
    { id: 'energy', name: 'げんき', icon: 'bolt' }
  ];

  const breed = $derived(BREEDS[pet.breed]);
  const love = $derived(hearts(pet));
</script>

<div class="card">
  <span class="face" style:background={breed.color}><Icon name={breed.kind} size="80%" /></span>
  <div class="rows">
    <div class="top">
      <span class="name">{pet.name}</span>
      <span class="breed">{breed.name}</span>
      <span class="hearts" role="img" aria-label="なかよし {love}">
        {#each { length: 5 }, i (i)}
          <span class:dim={i >= love}><Icon name="heart" /></span>
        {/each}
      </span>
      <span class="money"><Icon name="coin" />{money}</span>
    </div>
    <div class="meters">
      {#each METERS as m (m.id)}
        {@const v = Math.round(pet.stats[m.id])}
        <span class="meter" class:low={v < LOW} role="img" aria-label="{m.name} {v}">
          <Icon name={m.icon} />
          <span class="bar"><span class="fill" style:width="{v}%"></span></span>
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  /* ✕ と ↻（12..68px）のあいだ、ヒントの吹き出し（72px〜）より上に収める */
  .card {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 72px;
    right: 72px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 520px;
    height: 54px;
    margin-inline: auto;
    padding: 4px 10px 4px 4px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: rgb(255 250 242 / 0.92);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    pointer-events: none;
    container-type: inline-size;
  }

  .face {
    display: grid;
    flex: none;
    place-items: center;
    width: 42px;
    aspect-ratio: 1;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  .rows {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: clamp(12px, 6cqw, 17px);
    white-space: nowrap;
  }

  .name {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
  }

  .breed {
    color: var(--line-soft);
    font-size: 0.75em;
  }

  .hearts {
    display: flex;
    font-size: 0.75em;
  }

  .dim {
    opacity: 0.3;
    filter: grayscale(1);
  }

  .money {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    font-size: 12px;
  }

  .meter {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .bar {
    flex: 1;
    height: 8px;
    overflow: hidden;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    background: #fff;
  }

  .fill {
    display: block;
    height: 100%;
    background: #7ad67a;
    transition: width 400ms;
  }

  .low .fill {
    background: var(--pastel-p2);
  }

  @container (width < 300px) {
    .breed {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
