<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { createState, pinAt, pull, step, WORLD_H } from './engine';
  import { PinFx } from './effects';
  import { levelFor } from './levels';
  import { background, paint } from './paint';
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
  let done = false;
  /** 背景の石積みは大きさが変わったときだけ描き直す */
  let bg: HTMLCanvasElement | undefined;
  const fx = new PinFx();
  let progress = $state(0);

  const input = new BoardInput({
    down: (_event, bx, by) => {
      const [px, py] = input.px(bx, by);
      const i = pinAt(game, (px - view.ox) / view.scale, (py - view.oy) / view.scale);
      if (i < 0 || !pull(game, i)) return;
      pulledAt[i] = now;
      sounds.pull();
      fx.pulled(game, i);
    }
  });

  function restart() {
    game = fresh();
    pulledAt = [];
    fx.reset();
    progress = 0;
    done = false;
  }

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w, (h - 96) / WORLD_H);
    view = { scale, ox: (w - scale) / 2, oy: 76 + (h - 96 - scale * WORLD_H) / 2 };
    ctx = canvas.getContext('2d');
    bg ??= document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const b = bg.getContext('2d')!;
    b.scale(dpr, dpr);
    background(b, w, h);
  }

  function frame(dt: number) {
    now += dt;
    step(game, dt);
    progress = fx.update(game, dt);
    if (game.result && !done) {
      done = true;
      const cleared = game.result === 'clear';
      fx.finished(game);
      setTimeout(() => onfinish(cleared), 2000);
    }
    if (!ctx) return;
    const dpr = devicePixelRatio;
    const [sx, sy] = fx.shake.offset(dt, 14);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) ctx.drawImage(bg, 0, 0);
    const s = view.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (view.ox + sx) * dpr, (view.oy + sy) * dpr);
    paint(ctx, game, pulledAt, now);
    fx.draw(ctx);
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
  <span class="meter" role="img" aria-label="あつめた金貨 {Math.round(progress * 100)}%"
    ><span class="fill" style:width="{progress * 100}%"></span><span class="coin">💰</span></span
  >
  <button class="retry" onpointerdown={(e) => e.stopPropagation()} onclick={restart} aria-label="やりなおし">↻</button>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #e4c193;
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

  .meter {
    position: absolute;
    top: 60px;
    left: 50%;
    width: 200px;
    height: 18px;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(90 50 20 / 0.25);
    translate: -50% 0;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(to bottom, #fff3a0, #ffc233);
    transition: width 200ms;
  }

  .coin {
    position: absolute;
    top: 50%;
    left: -18px;
    font-size: 26px;
    translate: 0 -50%;
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
