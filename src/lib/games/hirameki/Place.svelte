<script lang="ts">
  import { sounds } from './sounds';
  import type { PlaceQ } from './types';

  /** cells は駒を置いたます目の番号（y * cols + x） */
  let { p, cells = $bindable() }: { p: PlaceQ; cells: number[] } = $props();

  function press(c: number) {
    if (cells.includes(c)) cells = cells.filter((d) => d !== c);
    else if (cells.length < p.count) cells = [...cells, c];
    else return sounds.wrong();
    sounds.pick();
  }
</script>

<div class="board" style:--cols={p.cols} style:--rows={p.rows}>
  {#each { length: p.cols * p.rows }, c (c)}
    {@const x = c % p.cols}
    {@const y = Math.floor(c / p.cols)}
    <button
      class="cell"
      class:dark={(x + y) % 2 === 1}
      class:on={cells.includes(c)}
      disabled={p.blocked?.includes(c)}
      aria-label="ます {x + 1}-{y + 1}"
      aria-pressed={cells.includes(c)}
      onclick={() => press(c)}
    ></button>
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    width: min(100cqw, calc(100cqh * var(--cols) / var(--rows)));
    aspect-ratio: var(--cols) / var(--rows);
    overflow: hidden;
    border: 4px solid var(--line);
    border-radius: 10px;
  }

  .cell {
    position: relative;
    padding: 0;
    border: 1px solid #e8d6c0;
    background: #fffaf2;
    cursor: pointer;
  }

  .dark {
    background: #f6e6cf;
  }

  .cell:disabled {
    background: repeating-linear-gradient(45deg, #b8a898 0 4px, #cfc2b4 4px 8px);
    cursor: default;
  }

  /* 駒。ます目の大きさに合わせた丸 */
  .on::after {
    content: '';
    position: absolute;
    inset: 16%;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff 0 12%, #ff7f98 14%);
    box-shadow: 0 3px 0 rgb(91 74 66 / 0.25);
    animation: drop 260ms var(--spring);
  }

  @keyframes drop {
    from {
      scale: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .on::after {
      animation: none;
    }
  }
</style>
