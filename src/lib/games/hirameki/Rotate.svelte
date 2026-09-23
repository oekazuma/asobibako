<script lang="ts">
  import { onDestroy } from 'svelte';
  import { openSides, reach, rotateOk } from './engine';
  import { sounds } from './sounds';
  import type { RotateQ } from './types';

  let {
    p,
    turns = $bindable(),
    moves = $bindable(),
    onsolve
  }: { p: RotateQ; turns: number[]; moves: number; onsolve: () => void } = $props();

  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const lit = $derived(reach(p, turns));
  /** 辺の真ん中（0 上・1 右・2 下・3 左） */
  const EDGE = [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50]
  ];
  const ARROW = ['↑', '→', '↓', '←'];

  function turn(c: number) {
    if (done || p.tiles[c].fixed) return;
    turns = turns.map((t, k) => (k === c ? (t + 1) % 4 : t));
    moves += 1;
    sounds.pick();
    if (!rotateOk(p, turns)) return;
    done = true;
    timer = setTimeout(onsolve, 400);
  }

  const at = (x: number, y: number) => ({
    left: `${((x + 0.5) / p.cols) * 100}%`,
    top: `${((y + 0.5) / p.rows) * 100}%`
  });
  const src = $derived(at(p.source.x, p.source.y));
  const goal = $derived(at(p.target % p.cols, Math.floor(p.target / p.cols)));
</script>

<div class="wrap" style:--cols={p.cols} style:--rows={p.rows} class:light={p.mode === 'light'}>
  <div class="board">
    {#each { length: p.tiles.length }, c (c)}
      {@const tile = p.tiles[c]}
      {@const on = lit.has(c)}
      <button
        class="tile"
        class:fixed={tile.fixed}
        class:on
        aria-label="タイル {c + 1}{tile.fixed ? '（固定）' : ''}"
        disabled={tile.fixed}
        onclick={() => turn(c)}
      >
        <svg viewBox="0 0 100 100" style:rotate="{tile.shape === 'mirror' ? 0 : turns[c] * 90}deg">
          {#if tile.shape === 'mirror'}
            {@const [a, b] = turns[c] % 2 === 0 ? [85, 15] : [15, 85]}
            <line x1="15" y1={a} x2="85" y2={b} class="mirror" />
          {:else if tile.shape !== 'empty'}
            {#each openSides(tile.shape, 0) as d (d)}
              <line x1="50" y1="50" x2={EDGE[d][0]} y2={EDGE[d][1]} class="pipe" />
              <line x1="50" y1="50" x2={EDGE[d][0]} y2={EDGE[d][1]} class="core" />
            {/each}
            <circle cx="50" cy="50" r={tile.shape === 'end' ? 20 : 11} class="joint" />
          {/if}
        </svg>
      </button>
    {/each}
    <span class="goal" class:reached={lit.has(p.target)} style:left={goal.left} style:top={goal.top}></span>
    <span class="source" style:left={src.left} style:top={src.top}>{ARROW[p.source.dir]}</span>
  </div>
</div>

<style>
  .wrap {
    /* 盤の外の蛇口（光源）のぶん、まわりに 1 ます空ける */
    --cell: min(calc(100cqw / (var(--cols) + 2)), calc(100cqh / (var(--rows) + 2)));
    padding: var(--cell);
  }

  .board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell));
    grid-auto-rows: var(--cell);
    border: 4px solid var(--line);
    border-radius: 8px;
    background: #fffaf2;
  }

  .tile {
    padding: 0;
    border: 1px solid #e3d4c1;
    background: #fffaf2;
    cursor: pointer;
  }

  /* 回らないタイルは、くすんだ地に四隅の鋲 */
  .fixed {
    background:
      radial-gradient(circle at 12% 12%, #8a7f76 0 5%, #0000 6%),
      radial-gradient(circle at 88% 12%, #8a7f76 0 5%, #0000 6%),
      radial-gradient(circle at 12% 88%, #8a7f76 0 5%, #0000 6%),
      radial-gradient(circle at 88% 88%, #8a7f76 0 5%, #0000 6%), #e6ddd2;
    cursor: default;
  }

  .light .on {
    background-color: #fff3a0;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    transition: rotate 160ms ease-out;
  }

  .pipe {
    stroke: var(--line);
    stroke-width: 30;
  }

  .core {
    stroke: #d9d2ca;
    stroke-width: 20;
  }

  .joint {
    fill: #d9d2ca;
    stroke: var(--line);
    stroke-width: 4;
  }

  .on .core,
  .on .joint {
    fill: #4db5ff;
    stroke: #4db5ff;
  }

  .on .joint {
    stroke: var(--line);
  }

  .mirror {
    stroke: #8fa6bd;
    stroke-width: 12;
    stroke-linecap: round;
  }

  .goal,
  .source {
    position: absolute;
    display: grid;
    place-items: center;
    width: calc(var(--cell) * 0.9);
    height: calc(var(--cell) * 0.9);
    border-radius: 50%;
    translate: -50% -50%;
    pointer-events: none;
  }

  .goal {
    border: 4px dashed #ff7f98;
  }

  .goal.reached {
    border-style: solid;
    border-color: #2f8f5b;
  }

  .source {
    width: calc(var(--cell) * 0.7);
    height: calc(var(--cell) * 0.7);
    border: 3px solid var(--line);
    background: #4db5ff;
    color: #fff;
    font-size: calc(var(--cell) * 0.4);
    font-weight: 900;
  }

  .light .source {
    background: #ffc233;
    box-shadow: 0 0 16px 6px #ffe27a;
  }

  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }
</style>
