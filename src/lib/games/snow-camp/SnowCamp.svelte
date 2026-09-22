<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { createState, step, type CampEvent } from './engine';
  import { CampFx } from './effects';
  import Hud from './Hud.svelte';
  import { overlay } from './overlay';
  import { objective } from './guide';
  import { CampWorld } from './world3d';
  import { sounds } from './sounds';

  let { level, onfinish }: SoloProps = $props();

  /** 指をこれだけ（ピクセル）ずらすと全速力 */
  const STICK = 60;
  let board: HTMLDivElement;
  /** 3D の雪原と、その上に文字・火花・雪を重ねる 2D の canvas */
  let gl: HTMLCanvasElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let world: CampWorld | undefined;
  // level はゲームごと作り直されるので、最初の値だけ使えばよい
  const fresh = () => createState(level);
  const game = fresh();
  let wallet = $state(0);
  /** いまやること。画面の上に出す */
  let hint = $state('');
  let goal = $state(game.pads.find((p) => p.id === 'home')!.cost);
  /** 仮想スティック。指を置いた位置からずらした向きへ歩く */
  let stick: { id: number; x: number; y: number } | null = null;
  const fx = new CampFx();
  let now = 0;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (stick) return;
      const [px, py] = input.px(x, y);
      stick = { id: event.pointerId, x: px, y: py };
    },
    up: (event) => {
      if (stick?.id === event.pointerId) stick = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    ctx = canvas.getContext('2d');
    world?.resize(w, h);
  }

  function stickVector() {
    const finger = stick && input.fingers.all.get(stick.id);
    if (!stick || !finger) return { x: 0, y: 0, px: 0, py: 0 };
    const [fx, fy] = input.px(finger.x, finger.y);
    const dx = fx - stick.x;
    const dy = fy - stick.y;
    const len = Math.hypot(dx, dy);
    const k = len < 6 ? 0 : Math.min(1, len / STICK) / len;
    return { x: dx * k, y: dy * k, px: fx, py: fy };
  }

  function play(events: CampEvent[]) {
    for (const event of events) {
      fx.handle(event, game);
      world?.handle(event, game);
      if (event.type === 'hit') sounds.hit();
      else if (event.type === 'clear') {
        sfx.finish();
        finishTimer = setTimeout(() => onfinish(true), 1500);
      } else if (event.type !== 'cooked') sounds[event.type]();
    }
  }

  function frame(dt: number) {
    now += dt;
    const move = stickVector();
    play(step(game, dt, move));
    fx.step(dt, game);
    if (wallet !== game.wallet) wallet = game.wallet;
    const home = game.pads.find((p) => p.id === 'home')!;
    if (goal !== home.cost - home.paid) goal = home.cost - home.paid;
    if (!ctx) return;
    const [w, h] = input.px(1, 1);
    const todo = objective(game);
    if (hint !== todo.text) hint = todo.text;
    world?.update(game, dt, now, move, todo);
    world?.render();
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (world) {
      const to = (x: number, y: number, z: number) => world!.project(x, y, z, w, h);
      overlay(ctx, game, to);
      fx.drawWorld(ctx, (x, y) => to(x, y, 0.08));
    }
    fx.drawSnow(ctx, w, h);
    if (stick) {
      ctx.beginPath();
      ctx.arc(stick.x, stick.y, STICK, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(stick.x + move.x * STICK, stick.y + move.y * STICK, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(31 155 255 / 0.6)';
      ctx.fill();
    }
  }

  onMount(() => {
    world = new CampWorld(gl, game);
    const unobserve = input.observe(board, resize);
    const stop = animate(frame);
    return () => {
      stop();
      unobserve();
      world?.dispose();
      clearTimeout(finishTimer);
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
  aria-label="雪原サバイバルの雪原"
>
  <canvas bind:this={gl}></canvas>
  <canvas bind:this={canvas}></canvas>
  <Hud {level} {wallet} {goal} {hint} />
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #e3eefb;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
