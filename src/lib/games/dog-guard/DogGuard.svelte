<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { addPoint, createState, DEFEND_S, finishStroke, step, WORLD_H } from './engine';
  import { levelFor } from './levels';
  import { paint } from './paint';
  import { sounds } from './sounds';

  let { level, onfinish }: SoloProps = $props();

  const TOP = 90;
  let board: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(levelFor(level));
  let game = fresh();
  /** 画面の表示に要る分だけを Svelte の状態に写す。ハチや線は毎フレーム canvas に描く */
  let phase = $state(game.phase);
  let ink = $state(1);
  let view = { scale: 1, ox: 0, oy: 0 };
  /** 線を引いている指。2 本目の指は無視する */
  let drawing: number | null = null;
  let now = 0;
  let inked = 0;
  let left = $state(DEFEND_S);

  const toWorld = (bx: number, by: number) => {
    const [px, py] = input.px(bx, by);
    return [(px - view.ox) / view.scale, (py - view.oy) / view.scale] as const;
  };

  const input = new BoardInput({
    down: (event, x, y) => {
      if (drawing !== null || game.phase !== 'draw') return;
      drawing = event.pointerId;
      addPoint(game, ...toWorld(x, y));
    },
    up: (event) => {
      if (event.pointerId !== drawing) return;
      drawing = null;
      if (finishStroke(game)) sounds.go();
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    const scale = Math.min(w, (h - TOP) / WORLD_H);
    view = { scale, ox: (w - scale) / 2, oy: TOP + (h - TOP - scale * WORLD_H) / 2 };
    ctx = canvas.getContext('2d');
  }

  function frame(dt: number) {
    now += dt;
    const finger = drawing === null ? undefined : input.fingers.all.get(drawing);
    if (finger && addPoint(game, ...toWorld(finger.x, finger.y)) && inked++ % 4 === 0) sounds.ink();
    for (const event of step(game, dt)) {
      if (event.type === 'bump') sounds.bump();
      else if (event.type === 'stung' || event.type === 'clear') {
        (event.type === 'clear' ? sfx.finish : sounds.stung)();
        setTimeout(() => onfinish(event.type === 'clear'), 1500);
      }
    }
    if (phase !== game.phase) phase = game.phase;
    const inkLeft = Math.round((game.ink / game.level.ink) * 50) / 50;
    if (ink !== inkLeft) ink = inkLeft;
    if (game.phase === 'defend') {
      const next = Math.ceil(DEFEND_S - game.time);
      if (next !== left) left = next;
      if (Math.random() < dt * 4) sounds.buzz();
    }
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = view.scale * devicePixelRatio;
    ctx.setTransform(s, 0, 0, s, view.ox * devicePixelRatio, view.oy * devicePixelRatio);
    paint(ctx, game, now);
  }

  function restart() {
    if (game.phase === 'done') return;
    game = fresh();
    drawing = null;
    left = DEFEND_S;
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
  aria-label="線を引いて守るの画面"
>
  <canvas bind:this={canvas}></canvas>
  <div class="hud">
    <span class="level sticker">レベル {level}</span>
    {#if phase === 'draw'}
      <span class="tip">線をかいて 犬を まもろう！</span>
      <span class="ink" role="img" aria-label="のこりのインク {Math.round(ink * 100)}%"
        ><span class="fill" style:width="{ink * 100}%"></span></span
      >
    {:else}
      <span class="count sticker" role="timer">{phase === 'defend' ? left : ''}</span>
    {/if}
  </div>
  <button class="retry" onpointerdown={(e) => e.stopPropagation()} onclick={restart} aria-label="やりなおし">↻</button>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: var(--dots), linear-gradient(to bottom, #cdeeff, #f4fbe9);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hud {
    position: absolute;
    top: 14px;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    translate: -50% 0;
    pointer-events: none;
  }

  .level {
    font-size: 24px;
  }

  .tip {
    font-size: 15px;
    font-weight: 800;
    color: var(--ink-soft);
  }

  .ink {
    width: 180px;
    height: 14px;
    overflow: hidden;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.12);
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--ink);
  }

  .count {
    font-size: 40px;
    color: var(--p2);
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
