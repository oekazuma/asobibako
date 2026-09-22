<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { createState, steer, step } from './engine';
  import { paint } from './paint';
  import { sounds } from './sounds';

  let { level, onfinish }: SoloProps = $props();

  let board: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(level);
  const game = fresh();
  /** 指を置いた位置と、そのときの群れの位置。指を動かした分だけ群れを動かす */
  let grab: { id: number; from: number; x: number } | null = null;
  let hits = 0;

  const input = new BoardInput({
    down: (event, x) => (grab = { id: event.pointerId, from: x, x: game.x }),
    up: (event) => {
      if (grab?.id === event.pointerId) grab = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    ctx = canvas.getContext('2d');
  }

  function frame(dt: number) {
    const finger = grab && input.fingers.all.get(grab.id);
    if (grab && finger) steer(game, grab.x + (finger.x - grab.from) * 1.3);
    for (const event of step(game, dt)) {
      if (event.type === 'gate') (event.good ? sounds.good : sounds.bad)();
      else if (event.type === 'hit') {
        // 打ち合いの音は毎回だと鳴りすぎるので間引く
        if (hits++ % 3 === 0) sounds.hit();
      } else {
        (event.type === 'clear' ? sfx.finish : sounds.fail)();
        setTimeout(() => onfinish(event.type === 'clear'), 1500);
      }
    }
    if (!ctx) return;
    const [w, h] = input.px(1, 1);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paint(ctx, game, w, h);
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
  aria-label="数のゲートの道"
>
  <canvas bind:this={canvas}></canvas>
  <span class="level sticker">レベル {level}</span>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #fff;
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
  }
</style>
