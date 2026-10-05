<script lang="ts">
  import { ANIMALS, type AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';

  /** ふたりで遊ぶときに、つながったあとで自分の動物を選ぶ。始めは最後に遊んだ子 */
  let { records, onpick }: { records: Records; onpick: (id: AnimalId) => void } = $props();

  let touched = $state<AnimalId | null>(null);
  const chosen = $derived(touched ?? (records.unlocked.includes(records.animal) ? records.animal : 'dog'));
</script>

<p class="note">いっしょに あそぶ 子を えらんでね</p>
<div class="tiles" role="listbox" aria-label="動物">
  {#each ANIMALS as a (a.id)}
    {@const open = records.unlocked.includes(a.id)}
    <button
      class="as-card tile"
      class:on={chosen === a.id}
      class:closed={!open}
      role="option"
      aria-selected={chosen === a.id}
      aria-label={open ? a.name : '？？？'}
      data-animal={a.id}
      disabled={!open}
      onclick={() => (touched = a.id)}
    >
      <span class="face"><PixelIcon art={ANIMAL_ART[a.id].forms[0].walk} size="min(9cqw, 5.4cqh, 52px)" /></span>
    </button>
  {/each}
</div>
<button class="as-card as-go" data-go onclick={() => onpick(chosen)}>この子で あそぶ</button>

<style>
  .note {
    margin: 0;
    color: #fff3d6;
    text-align: center;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: min(1.6cqw, 10px);
  }

  .tile {
    justify-content: center;
    padding: min(1cqh, 8px) 0;
  }

  .tile.on {
    background: #ffe28a;
    box-shadow:
      inset 0 0 0 3px #ffd84a,
      0 4px 0 #8a6a4a;
  }

  .closed {
    background: #d9cbb0;
    cursor: default;
  }

  .closed .face {
    filter: brightness(0);
    opacity: 0.55;
  }

  .face {
    display: flex;
  }

  .as-go {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
