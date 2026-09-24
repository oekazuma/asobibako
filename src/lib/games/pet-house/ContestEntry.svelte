<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import { CONTESTS, ENTRY_ENERGY, RANK_COLOR, RANKS, contestOf, entry, prize, topRank } from './contest';
  import { kindOf, type Pet, type Save } from './engine';
  import type { ContestId } from './types';

  let { save, pet, onstart }: { save: Save; pet: Pet; onstart: (id: ContestId, rank: number) => void } = $props();

  const ICON: Record<ContestId, IconName> = { frisbee: 'frisbee', wand: 'wand', agility: 'bolt', obedience: 'paw' };

  const list = $derived(CONTESTS.filter((c) => c.kinds.includes(kindOf(pet.breed))));
  let chosen = $state<ContestId | null>(null);
  const id = $derived(chosen && list.some((c) => c.id === chosen) ? chosen : list[0].id);
  let picked = $state<number | null>(null);
  const top = $derived(topRank(save, id));
  const rank = $derived(picked !== null && picked <= top ? picked : top);
  const tired = $derived(entry(pet, id) === 'tired');

  function pick(next: ContestId) {
    chosen = next;
    picked = null;
  }
</script>

<div class="entry">
  <div class="events">
    {#each list as c (c.id)}
      <button class="pet-choice" class:on={c.id === id} aria-pressed={c.id === id} onclick={() => pick(c.id)}>
        <Icon name={ICON[c.id]} size="42px" />
        <span>{c.name}</span>
        <span class="cups">
          {#each { length: save.contest[c.id] }, r (r)}
            <span class="cup" style:background={RANK_COLOR[r]}></span>
          {/each}
        </span>
      </button>
    {/each}
  </div>
  <div class="ranks" role="group" aria-label="クラス">
    {#each RANKS as name, r (name)}
      <button
        class="rank"
        class:on={r === rank}
        style:--c={RANK_COLOR[r]}
        disabled={r > top}
        aria-pressed={r === rank}
        onclick={() => (picked = r)}
      >
        {name}
      </button>
    {/each}
  </div>
  <p class="how">{contestOf(id).how}</p>
  <p class="prize"><Icon name="coin" /> 1いの しょうきん {prize(rank, 1)}コイン</p>
  {#if tired}
    <p class="warn">{pet.name}は げんきが たりないよ（げんき {ENTRY_ENERGY} から でられる）。すこし やすませよう</p>
  {/if}
  <button class="pill gold start" disabled={tired} onclick={() => onstart(id, rank)}>
    <Icon name="trophy" size="1.3em" />{RANKS[rank]} クラスに でる
  </button>
</div>

<style>
  .entry {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .events {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
  }

  .cups {
    display: flex;
    gap: 3px;
    min-height: 12px;
  }

  .cup {
    width: 12px;
    height: 12px;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  .ranks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .rank {
    flex: 1 1 auto;
    padding: 8px 10px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    box-shadow: inset 0 -6px 0 var(--c);
    color: var(--line);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .rank.on {
    background: var(--pastel-gold);
  }

  .rank:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .how,
  .prize,
  .warn {
    margin: 0;
    font-weight: 700;
    line-height: 1.5;
  }

  .warn {
    color: #c0392b;
  }

  .start {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 18px;
  }

  .start:disabled {
    opacity: 0.5;
  }
</style>
