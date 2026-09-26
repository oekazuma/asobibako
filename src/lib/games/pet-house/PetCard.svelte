<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import { BREEDS } from './breeds';
  import { daysTogether, hearts, LOW, type Pet } from './engine';
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

<div class="card pet-card">
  <div class="top">
    <span class="face" style:background={breed.color}><Icon name={breed.kind} size="80%" /></span>
    <span class="name">{pet.name}</span>
    <span class="breed">{breed.name}・うちに きて {daysTogether(pet, Date.now())} にちめ</span>
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
        <Icon name={m.icon} size="22px" />
        <span class="label">{m.name}</span>
        <span class="bar"><span class="fill" style:width="{v}%"></span></span>
      </span>
    {/each}
  </div>
</div>

<style>
  /* ✕ と ↻（12..68px）のあいだに収める。2 段なので、ヒントの吹き出しは札の下へずらす */
  .card {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 72px;
    right: 72px;
    z-index: 2;
    display: grid;
    gap: 6px;
    max-width: 540px;
    margin-inline: auto;
    padding: 6px 12px 8px 6px;
    border: 3px solid var(--line);
    border-radius: 22px;
    background: rgb(255 250 242 / 0.94);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    pointer-events: none;
    container-type: inline-size;
  }

  :global(.stage:has(.pet-card) > .hint) {
    top: calc(max(12px, env(safe-area-inset-top)) + 118px);
  }

  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: clamp(13px, 6cqw, 18px);
    white-space: nowrap;
  }

  .face {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    aspect-ratio: 1;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  .name {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
  }

  .breed {
    overflow: hidden;
    min-width: 0;
    color: var(--line-soft);
    font-size: 0.75em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hearts {
    display: flex;
    font-size: 0.8em;
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
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 12px;
    padding-left: 4px;
  }

  .meter {
    display: grid;
    grid-template-columns: 22px auto 1fr;
    align-items: center;
    gap: 5px;
    font-size: clamp(12px, 4.6cqw, 15px);
  }

  .bar {
    height: 12px;
    overflow: hidden;
    border: 2px solid var(--line);
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

  .low :global(.icon) {
    animation: wobble 900ms ease-in-out infinite;
  }

  @keyframes wobble {
    0%,
    100% {
      rotate: 0deg;
    }
    25% {
      rotate: -12deg;
    }
    75% {
      rotate: 12deg;
    }
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

    .low :global(.icon) {
      animation: none;
    }
  }
</style>
