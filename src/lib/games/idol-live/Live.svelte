<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import type { Result } from './judge';
  import type { Coord } from './outfits';
  import { Show } from './show.svelte';

  let { coord, bonus, onend }: { coord: Coord; bonus: number; onend: (r: Result) => void } = $props();

  // ライブは 1 曲ごとに作り直されるので、最初の衣装だけ使えばよい
  const fresh = () => new Show(coord, bonus, onend);
  const show = fresh();
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  const input = new BoardInput({
    down: (event, x, y) => show.down(event.pointerId, ...input.px(x, y)),
    up: (event) => show.up(event.pointerId)
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
  }

  onMount(() => {
    const stop = animate((dt) => {
      const [w, h] = input.px(1, 1);
      for (const [id, f] of input.fingers.all) show.move(id, ...input.px(f.x, f.y));
      show.frame(dt, w, h);
      if (!ctx) return;
      const dpr = devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      show.draw(ctx, w, h);
    });
    return () => {
      stop();
      show.stop();
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="ライブのステージ">
  <canvas bind:this={canvas}></canvas>
  {#if !show.over}
    <p class="score">
      <span class="caption">SCORE</span>
      {show.score.toLocaleString()}
    </p>
    <span class="hype" style:--v={show.hype} aria-hidden="true"></span>
  {/if}
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #1b1238;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* スコアとボルテージは、ライブを邪魔しないよう上の端に小さく置く */
  .score {
    position: absolute;
    top: max(18px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    margin: 0;
    color: #fff;
    font-weight: 800;
    font-size: clamp(16px, min(2.4cqh, 4.6cqw), 26px);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 6px rgb(0 0 0 / 0.5);
    pointer-events: none;
  }

  .caption {
    font-size: 0.6em;
    opacity: 0.8;
  }

  .hype {
    position: absolute;
    top: calc(max(18px, env(safe-area-inset-top)) + clamp(26px, 4cqh, 40px));
    left: 50%;
    translate: -50% 0;
    width: clamp(120px, 30cqw, 220px);
    height: 8px;
    border-radius: 999px;
    background:
      linear-gradient(90deg, #ff9cc4, #ffd43b) 0 0 / calc(var(--v) * 100%) 100% no-repeat,
      rgb(255 255 255 / 0.2);
    box-shadow: 0 0 calc(var(--v) * 16px) rgb(255 180 220 / 0.9);
    transition: background-size 200ms;
    pointer-events: none;
  }
</style>
