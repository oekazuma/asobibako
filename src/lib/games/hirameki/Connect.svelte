<script module lang="ts">
  import type { ConnectQ } from './types';

  /** 組 i の線が、両はしの点どうしをつないでいる */
  export function joined(p: ConnectQ, paths: number[][], i: number) {
    const { a, b } = p.pairs[i];
    const [s, t] = [a.y * p.cols + a.x, b.y * p.cols + b.x];
    const path = paths[i];
    return path.length > 1 && ((path[0] === s && path.at(-1) === t) || (path[0] === t && path.at(-1) === s));
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { capture } from '$lib/board-input';
  import { cellAt } from './cell';
  import { connectOk } from './engine';
  import { sounds } from './sounds';

  let { p, paths = $bindable(), onsolve }: { p: ConnectQ; paths: number[][]; onsolve: () => void } = $props();

  let board: HTMLDivElement;
  let drawing: { id: number; i: number } | null = null;
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  const n = $derived(p.cols * p.rows);
  const index = (q: { x: number; y: number }) => q.y * p.cols + q.x;
  /** ます目 → その点を持つ組 */
  const ends = $derived(new Map(p.pairs.flatMap((pr, i) => [[index(pr.a), i] as const, [index(pr.b), i] as const])));
  const owner = (c: number) => paths.findIndex((path) => path.includes(c));
  const covered = $derived(new Set(paths.flat()));
  const put = (i: number, path: number[]) => (paths = paths.map((q, k) => (k === i ? path : q)));

  function down(event: PointerEvent) {
    if (done || drawing) return;
    const c = cellAt(event, board, p.cols, p.rows);
    const end = ends.get(c);
    const i = end ?? owner(c);
    if (i === undefined || i < 0) return;
    capture(event);
    // 点から引き直すか、線の途中からその先を引き直す
    put(i, end === i ? [c] : paths[i].slice(0, paths[i].indexOf(c) + 1));
    drawing = { id: event.pointerId, i };
  }

  /** 線を 1 ます伸ばす（戻れば縮む）。伸ばせなければ false */
  function step(i: number, c: number): boolean {
    const path = paths[i];
    if (path.at(-2) === c) {
      put(i, path.slice(0, -1));
      return true;
    }
    if (joined(p, paths, i) || p.blocked?.includes(c)) return false;
    const end = ends.get(c);
    if (end !== undefined && end !== i) return false;
    if (path.includes(c)) put(i, path.slice(0, path.indexOf(c) + 1));
    else {
      const j = owner(c);
      // 相手の線に入ったら、相手の線はそこで切れる
      if (j >= 0) put(j, paths[j].slice(0, paths[j].indexOf(c)));
      put(i, [...path, c]);
      sounds.pick();
    }
    return true;
  }

  function move(event: PointerEvent) {
    if (drawing?.id !== event.pointerId) return;
    const c = cellAt(event, board, p.cols, p.rows);
    if (c < 0) return;
    // 指が速くてますを飛ばしても、1 ますずつたどる
    for (let guard = 0; guard < n; guard++) {
      const last = paths[drawing.i].at(-1)!;
      if (last === c) return;
      const [dx, dy] = [(c % p.cols) - (last % p.cols), Math.floor(c / p.cols) - Math.floor(last / p.cols)];
      const next = Math.abs(dx) >= Math.abs(dy) ? last + Math.sign(dx) : last + Math.sign(dy) * p.cols;
      if (!step(drawing.i, next)) return;
    }
  }

  function up(event: PointerEvent) {
    if (drawing?.id !== event.pointerId) return;
    drawing = null;
    const pick = paths.flatMap((path, i) => (i ? [-1, ...path] : path));
    if (!connectOk(p, pick)) return;
    done = true;
    timer = setTimeout(onsolve, 300);
  }

  const center = (c: number) => `${(c % p.cols) + 0.5},${Math.floor(c / p.cols) + 0.5}`;
</script>

<div
  class="board"
  bind:this={board}
  style:--cols={p.cols}
  style:--rows={p.rows}
  role="application"
  aria-label="線つなぎの盤。点からなぞって線を引く"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  {#each { length: n }, c (c)}
    <span class="cell" class:blocked={p.blocked?.includes(c)} class:hole={p.fill && !covered.has(c)}></span>
  {/each}
  <svg viewBox={`0 0 ${p.cols} ${p.rows}`} aria-hidden="true">
    {#each p.pairs as pair, i (pair)}
      <polyline points={paths[i].map(center).join(' ')} stroke={pair.color} class:joined={joined(p, paths, i)} />
      {#each [pair.a, pair.b] as q (q)}
        <circle cx={q.x + 0.5} cy={q.y + 0.5} r="0.32" fill={pair.color} />
      {/each}
    {/each}
  </svg>
</div>

<style>
  .board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    width: min(100cqw, calc(100cqh * var(--cols) / var(--rows)));
    aspect-ratio: var(--cols) / var(--rows);
    overflow: hidden;
    border: 4px solid var(--line);
    border-radius: 10px;
    background: #fffaf2;
    touch-action: none;
  }

  .cell {
    border: 1px solid #eadcc9;
  }

  .blocked {
    background: repeating-linear-gradient(45deg, #b8a898 0 4px, #cfc2b4 4px 8px);
  }

  /* 線で埋めなければならない盤で、まだ通っていないます */
  .hole {
    background: radial-gradient(circle, #ffd0da 0 12%, #0000 14%);
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  polyline {
    fill: none;
    stroke-width: 0.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.75;
  }

  polyline.joined {
    stroke-width: 0.36;
    opacity: 1;
  }

  circle {
    stroke: var(--line);
    stroke-width: 0.06;
  }
</style>
