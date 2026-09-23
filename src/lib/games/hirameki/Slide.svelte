<script lang="ts">
  import { onDestroy } from 'svelte';
  import { capture, toBoardPoint, TURNED_QUERY } from '$lib/board-input';
  import { slide, slideDone } from './engine';
  import { sounds } from './sounds';
  import type { Block, SlideQ } from './types';

  let {
    p,
    blocks = $bindable(),
    moves = $bindable(),
    onsolve
  }: { p: SlideQ; blocks: Block[]; moves: number; onsolve: () => void } = $props();

  const PASTEL = ['#8ec9ff', '#9be0a6', '#ffd45c', '#c9b6f2', '#ffc49b'];

  let board: HTMLDivElement;
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  /** 動かしているブロックと、最後に 1 ます進めたときの指の位置（ます目の単位） */
  let drag: { id: number; i: number; from: [number, number]; moved: boolean } | null = null;

  // 横向きで .stage が回っていても、盤そのものの向きのます目で数える
  function cell(event: PointerEvent): [number, number] {
    const [x, y] = toBoardPoint(
      event.clientX,
      event.clientY,
      board.getBoundingClientRect(),
      matchMedia(TURNED_QUERY).matches
    );
    return [x * p.cols, y * p.rows];
  }

  function down(event: PointerEvent, i: number) {
    if (done || drag) return;
    capture(event);
    drag = { id: event.pointerId, i, from: cell(event), moved: false };
  }

  /** 指が半ます以上進んだ向きへ 1 ますずつすべらせる。当たったらそこで止まる */
  function move(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    const at = cell(event);
    for (;;) {
      const [dx, dy] = [at[0] - drag.from[0], at[1] - drag.from[1]];
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const d = horizontal ? dx : dy;
      if (Math.abs(d) < 0.5) return;
      const step = Math.sign(d);
      const next = slide(p, blocks, drag.i, horizontal ? step : 0, horizontal ? 0 : step);
      if (!next) return;
      blocks = next;
      drag.from = horizontal ? [drag.from[0] + step, drag.from[1]] : [drag.from[0], drag.from[1] + step];
      drag.moved = true;
      sounds.pick();
    }
  }

  function up(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    if (drag.moved) moves += 1;
    drag = null;
    if (slideDone(p, blocks)) {
      done = true;
      timer = setTimeout(onsolve, 400);
    }
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const t = $derived(p.blocks[p.target]);
  /** 出口は、ゴールの位置が接している盤のふち（下・右・左・上の順に見る） */
  const exit = $derived(
    p.goal.y + t.h === p.rows ? 'bottom' : p.goal.x + t.w === p.cols ? 'right' : p.goal.x === 0 ? 'left' : 'top'
  );
</script>

<div class="board" bind:this={board} style:--cols={p.cols} style:--rows={p.rows}>
  <span
    class="goal {exit}"
    style:left={pct(p.goal.x, p.cols)}
    style:top={pct(p.goal.y, p.rows)}
    style:width={pct(t.w, p.cols)}
    style:height={pct(t.h, p.rows)}><span class="exit">出口</span></span
  >
  {#each { length: blocks.length }, i (i)}
    {@const b = blocks[i]}
    <button
      class="block"
      class:target={i === p.target}
      style:left={pct(b.x, p.cols)}
      style:top={pct(b.y, p.rows)}
      style:width={pct(b.w, p.cols)}
      style:height={pct(b.h, p.rows)}
      style:--c={b.color ?? (i === p.target ? '#ff7f98' : PASTEL[i % PASTEL.length])}
      aria-label={b.label ?? `ブロック ${i + 1}`}
      onpointerdown={(event) => down(event, i)}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    >
      {b.label ?? ''}
    </button>
  {/each}
</div>

<style>
  .board {
    position: relative;
    width: min(84cqw, calc(84cqh * var(--cols) / var(--rows)));
    aspect-ratio: var(--cols) / var(--rows);
    border: 4px solid var(--line);
    border-radius: 10px;
    background:
      linear-gradient(90deg, #e8d6c0 1px, #0000 1px) 0 0 / calc(100% / var(--cols)) 100%,
      linear-gradient(#e8d6c0 1px, #0000 1px) 0 0 / 100% calc(100% / var(--rows)),
      #fbf1e2;
    touch-action: none;
  }

  .goal {
    position: absolute;
    border: 3px dashed #ff7f98;
    border-radius: 8px;
  }

  /* 盤のふちの外に「出口」の札を出す */
  .exit {
    position: absolute;
    padding: 2px 10px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-p2);
    color: var(--line);
    font-size: clamp(11px, 2.4cqh, 15px);
    font-weight: 800;
    white-space: nowrap;
  }

  .bottom .exit {
    top: calc(100% + 8px);
    left: 50%;
    translate: -50% 0;
  }

  .top .exit {
    bottom: calc(100% + 8px);
    left: 50%;
    translate: -50% 0;
  }

  .right .exit {
    top: 50%;
    left: calc(100% + 8px);
    translate: 0 -50%;
    writing-mode: vertical-rl;
  }

  .left .exit {
    top: 50%;
    right: calc(100% + 8px);
    translate: 0 -50%;
    writing-mode: vertical-rl;
  }

  .block {
    position: absolute;
    padding: 0;
    border: 3px solid var(--line);
    border-radius: 12px;
    background: var(--c);
    /* 外側に盤の色のふちを重ね、となり合うブロックの境目を見せる */
    box-shadow:
      inset 0 0 0 4px #fff8,
      0 0 0 2px #fbf1e2;
    color: var(--line);
    font-size: clamp(13px, 3.4cqh, 24px);
    font-weight: 800;
    cursor: grab;
    touch-action: none;
    transition:
      left 120ms ease-out,
      top 120ms ease-out;
  }

  .target {
    border-width: 4px;
    font-size: clamp(15px, 4cqh, 30px);
  }

  @media (prefers-reduced-motion: reduce) {
    .block {
      transition: none;
    }
  }
</style>
