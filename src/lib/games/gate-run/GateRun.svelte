<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { Floaters, Particles, Shake } from '$lib/fx';
  import { createState, steer, step, type RunEvent } from './engine';
  import { paint, project } from './paint';
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
  let now = 0;
  const particles = new Particles();
  const floaters = new Floaters();
  const shake = new Shake();
  const CONFETTI = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b', '#b27bff'];

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

  function play(event: RunEvent, w: number, h: number) {
    const v = { w, h };
    if (event.type === 'gate') {
      (event.good ? sounds.good : sounds.bad)();
      const [x, y] = project(v, event.x, 1.05);
      const text = `${event.op.kind === 'x' ? '×' : event.op.kind}${event.op.n}`;
      floaters.add(text, x, y - h * 0.12, w * 0.12, event.good ? '#1f9bff' : '#ff4d5e');
      particles.burst(x, y - h * 0.1, {
        count: 24,
        color: event.good ? ['#9fd8ff', '#fff', '#1f9bff'] : ['#ffb3ba', '#ff4d5e'],
        speed: w * 0.5,
        size: w * 0.012,
        life: 0.6,
        gravity: h * 0.8
      });
    } else if (event.type === 'hit') {
      // 打ち合いの音と火花は毎回だと多すぎるので間引く
      if (hits++ % 3 !== 0) return;
      sounds.hit();
      const [x, y] = project(v, game.x, 1.17);
      particles.burst(x, y - h * 0.03, {
        count: 4,
        color: ['#fff3c4', '#ffc233'],
        speed: w * 0.4,
        size: w * 0.01,
        glow: true,
        life: 0.3
      });
      shake.add(0.08);
    } else {
      (event.type === 'clear' ? sfx.finish : sounds.fail)();
      if (event.type === 'clear')
        for (let i = 0; i < 5; i++)
          particles.burst(w * (0.1 + i * 0.2), h * 0.35, {
            count: 30,
            color: CONFETTI,
            speed: w * 0.7,
            size: w * 0.012,
            life: 1.6,
            gravity: h * 0.9
          });
      else shake.add(0.6);
      setTimeout(() => onfinish(event.type === 'clear'), 1500);
    }
  }

  function frame(dt: number) {
    now += dt;
    const [w, h] = input.px(1, 1);
    const finger = grab && input.fingers.all.get(grab.id);
    if (grab && finger) steer(game, grab.x + (finger.x - grab.from) * 1.3);
    for (const event of step(game, dt)) play(event, w, h);
    particles.step(dt);
    floaters.step(dt);
    if (!ctx) return;
    const [sx, sy] = shake.offset(dt, w * 0.02);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, sx * devicePixelRatio, sy * devicePixelRatio);
    ctx.clearRect(-w, -h, w * 3, h * 3);
    paint(ctx, game, { w, h }, now);
    particles.draw(ctx);
    floaters.draw(ctx);
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
