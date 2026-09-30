<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { compose, fillImage, type Art } from './art';
  import { regionAt, SIZE, type Regions } from './regions';

  let {
    art,
    regions,
    colors,
    onfill
  }: { art: Art; regions: Regions; colors: Record<number, string>; onfill: (region: number) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let fill = $state<HTMLCanvasElement>();

  const input = new BoardInput({
    down: (_event, x, y) => {
      const region = regionAt(regions, Math.floor(x * SIZE), Math.floor(y * SIZE));
      if (region >= 0) onfill(region);
    }
  });

  function draw() {
    if (ctx && fill) compose(ctx, fill, art, canvas.width);
  }

  function resize() {
    const [w] = input.px(1, 1);
    canvas.width = canvas.height = Math.round(w * (devicePixelRatio || 1));
    ctx = canvas.getContext('2d');
    draw();
  }

  $effect(() => {
    // 先に読んでおく。fill が無い最初の回に読まないと、この effect が何も追わなくなる
    const next = { art, regions, colors };
    if (!fill) return;
    fillImage(fill.getContext('2d')!, next.regions, next.colors, next.art);
    draw();
  });

  onMount(() => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    fill = c;
  });
</script>

<div class="sheet" use:input.board={resize}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .sheet {
    width: min(100cqw, 100cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
