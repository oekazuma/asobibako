<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { render, type Ink, type Stroke } from './strokes';

  let {
    strokes,
    pen = null,
    onink
  }: { strokes: Stroke[]; pen?: { color: string; size: number } | null; onink?: (ink: Ink) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  /** 描いている指。手のひらが先に触れても、描くのは最初の 1 本だけ */
  let finger: number | null = null;
  let last: [number, number] = [0, 0];

  function add(x: number, y: number) {
    // 描く時間が終わっても指を置いたままだと、自分の絵にだけ線が足されてほかの人の絵と食い違う
    if (!pen) return;
    if (Math.hypot(x - last[0], y - last[1]) < 0.003) return;
    last = [x, y];
    onink?.({ k: 'add', pts: [x, y] });
  }

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!pen || finger !== null) return;
      finger = event.pointerId;
      last = [x, y];
      onink?.({ k: 'start', color: pen.color, size: pen.size, x, y });
    },
    up: (event, _finger, x, y) => {
      if (event.pointerId !== finger) return;
      add(x, y);
      finger = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    if (ctx) render(ctx, strokes);
  }

  $effect(() => {
    // ctx より先に strokes を読む。ctx が無い最初の回に strokes を読まないと、この effect が何も追わなくなる
    const next = strokes;
    if (ctx) render(ctx, next);
  });

  onMount(() =>
    animate(() => {
      if (finger === null) return;
      const f = input.fingers.all.get(finger);
      if (f) add(f.x, f.y);
    })
  );
</script>

<div class="board" class:live={pen} use:input.board={resize}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .board {
    position: relative;
    width: min(100cqw, 100cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  .board.live {
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
