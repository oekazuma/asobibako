<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { createState, pinAt, pull, step, WORLD_H } from './engine';
  import { levelFor } from './levels';
  import { paint } from './paint';
  import { sounds } from './sounds';

  let { level, onfinish }: SoloProps = $props();

  let board: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(levelFor(level));
  let game = fresh();
  let pulledAt: number[] = [];
  /** 画面のピクセルと engine の座標の対応。箱ごと盤面の真ん中に収める */
  let view = { scale: 1, ox: 0, oy: 0 };
  let now = 0;
  let collected = 0;
  let rocks = 0;
  let done = false;

  const input = new BoardInput({
    down: (_event, bx, by) => {
      const [px, py] = input.px(bx, by);
      const i = pinAt(game, (px - view.ox) / view.scale, (py - view.oy) / view.scale);
      if (i < 0 || !pull(game, i)) return;
      pulledAt[i] = now;
      sounds.pull();
    }
  });

  function restart() {
    game = fresh();
    pulledAt = [];
    collected = rocks = 0;
  }

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / 1, (h - 70) / WORLD_H);
    view = { scale, ox: (w - scale) / 2, oy: 70 + (h - 70 - scale * WORLD_H) / 2 };
    ctx = canvas.getContext('2d');
  }

  function frame(dt: number) {
    now += dt;
    step(game, dt);
    if (game.collected > collected) sounds.coin();
    collected = game.collected;
    const r = game.particles.reduce((n, p) => n + (p.kind === 'rock' ? 1 : 0), 0);
    if (r > rocks) sounds.hiss();
    rocks = r;
    if (game.result && !done) {
      done = true;
      if (game.result === 'burned') sounds.burn();
      else if (game.result === 'clear') sfx.finish();
      setTimeout(() => onfinish(game.result === 'clear'), 2000);
    }
    if (!ctx) return;
    const dpr = devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.ox * dpr, view.oy * dpr);
    paint(ctx, game, pulledAt, now);
  }

  onMount(() => {
    const unobserve = input.observe(board, resize);
    const stop = animate(frame);
    return () => {
      stop();
      unobserve();
    };
  });
</script>

<div
  class="board"
  bind:this={board}
  onpointerdown={input.down}
  onpointermove={input.move}
  onpointerup={input.up}
  onpointercancel={input.up}
  role="application"
  aria-label="ピンぬきの盤面"
>
  <canvas bind:this={canvas}></canvas>
  <span class="level sticker">レベル {level}</span>
  <button class="retry" onpointerdown={(e) => e.stopPropagation()} onclick={restart} aria-label="やりなおし">↻</button>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: var(--dots), linear-gradient(to bottom, #d8f1ff, #fff3dc);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .level {
    position: absolute;
    top: 18px;
    left: 50%;
    translate: -50% 0;
    font-size: 26px;
    color: var(--ink);
  }

  .retry {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 48px;
    height: 48px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: var(--lift);
    font-size: 24px;
    font-weight: 800;
    cursor: pointer;
  }
</style>
