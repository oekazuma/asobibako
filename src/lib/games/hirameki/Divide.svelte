<script module lang="ts">
  /** 組の色。組の数は多くても 6 くらいまで */
  export const PART_COLORS = ['#8ec9ff', '#ff9fb3', '#9be0a6', '#ffd45c', '#c9b6f2', '#ffc49b', '#7fd6d0', '#e0b3e8'];
</script>

<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { capture } from '$lib/board-input';
  import { cellAt } from './cell';
  import { sounds } from './sounds';
  import type { DivideQ } from './types';

  /** groups は各ます目の組の番号（-1 はまだ塗っていない） */
  let { p, groups = $bindable() }: { p: DivideQ; groups: number[] } = $props();

  let color = $state(0);
  let board: HTMLDivElement;
  /** なぞっている指と、塗るか消すか（塗ってあるますを同じ色で押し始めたら消す） */
  let brush: { id: number; paint: number } | null = null;

  function paint(c: number) {
    if (c < 0 || p.blocked?.includes(c) || groups[c] === brush?.paint) return;
    groups = groups.map((g, k) => (k === c ? brush!.paint : g));
    sounds.pick();
  }

  function down(event: PointerEvent) {
    if (brush) return;
    const c = cellAt(event, board, p.cols, p.rows);
    if (c < 0) return;
    capture(event);
    brush = { id: event.pointerId, paint: groups[c] === color ? -1 : color };
    paint(c);
  }

  function move(event: PointerEvent) {
    if (brush?.id === event.pointerId) paint(cellAt(event, board, p.cols, p.rows));
  }

  function up(event: PointerEvent) {
    if (brush?.id === event.pointerId) brush = null;
  }
</script>

<div class="divide">
  <div class="palette" role="radiogroup" aria-label="塗る色">
    {#each { length: p.parts }, i (i)}
      <button
        class="swatch"
        role="radio"
        aria-checked={color === i}
        aria-label="色 {i + 1}"
        style:--c={PART_COLORS[i]}
        onclick={() => (color = i)}>{i + 1}</button
      >
    {/each}
  </div>
  <div
    class="board"
    bind:this={board}
    style:--cols={p.cols}
    style:--rows={p.rows}
    role="application"
    aria-label="塗り分ける盤。なぞって塗る"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    {#each { length: p.cols * p.rows }, c (c)}
      <span
        class="cell"
        class:blocked={p.blocked?.includes(c)}
        style:background={groups[c] >= 0 ? PART_COLORS[groups[c]] : undefined}
      >
        {#if p.marks?.includes(c)}<Icon name="star" size="70%" />{/if}
      </span>
    {/each}
  </div>
</div>

<style>
  .divide {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .palette {
    display: flex;
    gap: 8px;
  }

  .swatch {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 3px solid var(--line);
    border-radius: 50%;
    background: var(--c);
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  .swatch[aria-checked='true'] {
    outline: 4px solid var(--line);
    outline-offset: 3px;
    scale: 1.1;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    width: min(100cqw, calc((100cqh - 62px) * var(--cols) / var(--rows)));
    aspect-ratio: var(--cols) / var(--rows);
    overflow: hidden;
    border: 4px solid var(--line);
    border-radius: 10px;
    background: #fffaf2;
    touch-action: none;
  }

  .cell {
    display: grid;
    place-items: center;
    border: 1px solid #d9c9b5;
    transition: background-color 120ms;
  }

  .blocked {
    background: repeating-linear-gradient(45deg, #b8a898 0 4px, #cfc2b4 4px 8px);
  }
</style>
