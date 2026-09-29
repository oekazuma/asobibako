<script lang="ts">
  import { DIFFICULTIES, type Difficulty } from './dance';

  let {
    chosen = $bindable(),
    counts,
    ranks
  }: {
    chosen: Difficulty;
    /** 難しさごとのノーツの数 */
    counts: number[];
    /** 難しさごとのいちばん良かったランク。遊んでいなければ - */
    ranks: string[];
  } = $props();
</script>

<div class="levels">
  {#each DIFFICULTIES as name, d (name)}
    <button class="level d{d}" aria-pressed={chosen === d} onclick={() => (chosen = d as Difficulty)}>
      <strong>{name}</strong>
      <small>ノーツ {counts[d]}</small>
      <span class="rank">{ranks[d]}</span>
    </button>
  {/each}
</div>

<style>
  .levels {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    max-width: 520px;
    margin: 0 auto 16px;
  }

  .level {
    --c: #58c46b;
    display: grid;
    gap: 2px;
    padding: 10px 6px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: #fff;
    color: var(--line);
    cursor: pointer;
  }

  .level.d1 {
    --c: var(--p1);
  }

  .level.d2 {
    --c: var(--p2);
  }

  .level[aria-pressed='true'] {
    background: var(--c);
    color: #fff;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--c), #000 25%);
  }

  .level strong {
    font-size: 17px;
  }

  .level small {
    font-size: 12px;
    font-weight: 700;
  }

  .rank {
    font-size: 22px;
    font-weight: 900;
  }
</style>
