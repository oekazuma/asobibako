<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { addPoint, createState, finishStroke, step, WORLD_H } from './engine';
  import { levelFor } from './levels';
  import { CONFETTI, Particles, Shake } from '$lib/fx';
  import Hud from './Hud.svelte';
  import { backdrop, paint } from './paint';
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
  let left = $state(game.level.duration);
  const tip = $derived(levelFor(level).tip);
  const particles = new Particles();
  const shake = new Shake();
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

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
    if (finger && addPoint(game, ...toWorld(finger.x, finger.y)) && inked++ % 4 === 0) {
      sounds.ink();
      const tip = game.stroke[game.stroke.length - 1];
      particles.burst(tip.x, tip.y, {
        count: 2,
        color: ['#fff', '#ffe27a'],
        speed: 0.15,
        size: 0.006,
        life: 0.4,
        glow: true
      });
    }
    for (const event of step(game, dt)) {
      if (event.type === 'bump') {
        sounds.bump();
        particles.burst(event.x, event.y, {
          count: 5,
          color: ['#fff3c4', '#ffc233'],
          speed: 0.3,
          size: 0.006,
          life: 0.3,
          glow: true
        });
      } else if (event.type === 'stung' || event.type === 'clear') {
        const { x, y } = game.level.dogs[0];
        if (event.type === 'clear') {
          sfx.finish();
          for (let k = 0; k < 4; k++)
            particles.burst(0.15 + k * 0.23, 0.35, {
              count: 26,
              color: CONFETTI,
              speed: 0.7,
              size: 0.01,
              life: 1.6,
              gravity: 0.9
            });
        } else {
          sounds.stung();
          shake.add(0.8);
          particles.burst(x, y, {
            count: 24,
            color: ['#fff', '#ffc233', '#ff4d5e'],
            speed: 0.5,
            size: 0.012,
            life: 0.6
          });
        }
        finishTimer = setTimeout(() => onfinish(event.type === 'clear'), 1500);
      }
    }
    particles.step(dt);
    if (phase !== game.phase) phase = game.phase;
    const inkLeft = Math.round((game.ink / game.level.ink) * 50) / 50;
    if (ink !== inkLeft) ink = inkLeft;
    if (game.phase === 'defend') {
      const next = Math.ceil(game.level.duration - game.time);
      if (next !== left) left = next;
      if (Math.random() < dt * 4) sounds.buzz();
    }
    if (!ctx) return;
    const dpr = devicePixelRatio;
    const [w, h] = input.px(1, 1);
    const [sx, sy] = shake.offset(dt, 14);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(ctx, w, h, now);
    const s = view.scale * dpr;
    ctx.setTransform(s, 0, 0, s, (view.ox + sx) * dpr, (view.oy + sy) * dpr);
    paint(ctx, game, now);
    particles.draw(ctx);
  }

  function restart() {
    if (game.phase === 'done') return;
    game = fresh();
    drawing = null;
    left = game.level.duration;
  }

  onMount(() => {
    const unobserve = input.observe(board, resize);
    const stop = animate(frame);
    return () => {
      stop();
      unobserve();
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
  aria-label="線を引いて守るの画面"
>
  <canvas bind:this={canvas}></canvas>
  <Hud {level} {phase} {ink} {left} {tip} onretry={restart} />
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #9fdcff;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
