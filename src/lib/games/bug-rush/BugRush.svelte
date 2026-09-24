<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import { Particles } from '$lib/fx';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { bugAt, counts, createState, RUSH_S, step, tap } from './engine';
  import Hud from './Hud.svelte';
  import { paint } from './paint';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let canvas: HTMLCanvasElement;
  const game = createState(1);
  let tally = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let timeLeft = $state(game.timeLeft);
  let lastSecond = Math.ceil(game.timeLeft);
  let size = { width: 1, height: 1 };
  const particles = new Particles();
  const SHELL = ['#3b9d4a', '#2c7d39', '#fff'];

  function burst(x: number, y: number, count: number, color: readonly string[], speed: number) {
    particles.burst(x * size.width, y * size.height, {
      count,
      color,
      speed: speed * size.height,
      size: size.height * 0.008
    });
  }

  function sync() {
    const next = counts(game);
    if (next[1] !== tally[1] || next[2] !== tally[2]) tally = next;
  }

  const input = new BoardInput({
    down: (_e, x, y) => {
      const bug = bugAt(game, x, y);
      const result = bug ? tap(game, bug.id) : null;
      if (result?.type === 'hit') {
        sounds.hit();
        burst(x, y, 5, ['#fff'], 0.25);
      } else if (result?.type === 'send') {
        sounds.send();
        burst(x, y, 12, bug?.kind === 'beetle' ? ['#8a4b2a', '#6e3a1f', '#fff'] : SHELL, 0.45);
      }
      sync();
    }
  });

  /** Retina でもにじまないよう、canvas の画素数を表示の大きさ × devicePixelRatio に合わせる */
  function resize() {
    const [width, height] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    size = { width, height };
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onResize(aspect: number) {
    game.aspect = aspect;
    resize();
  }

  onMount(() => {
    const ctx = canvas.getContext('2d');
    const stop = animate((dt, now) => {
      for (const event of step(game, dt)) {
        if (event.type === 'land') {
          sounds.land();
          burst(event.x, event.y, 8, ['#c9a47e', '#e4cfb6'], 0.18);
        } else if (event.type === 'end') {
          sfx.finish();
          onfinish(event.winner);
        }
      }
      sync();
      particles.step(dt);
      if (ctx) paint(ctx, game.bugs, particles, size.width, size.height, now);
      // 時間のバーは CSS で滑らかに縮めるので、書き換えは 0.1 秒刻みで足りる
      if (Math.abs(timeLeft - game.timeLeft) >= 0.1) timeLeft = game.timeLeft;
      const second = Math.ceil(game.timeLeft);
      if (second !== lastSecond && second >= 0 && second <= 5) sounds.count(second === 0);
      lastSecond = second;
    });
    return () => stop();
  });
</script>

<div class="board" use:input.board={onResize} role="application" aria-label="虫送りの盤面">
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <div class="nest" class:rush={timeLeft <= RUSH_S}></div>

  <canvas bind:this={canvas}></canvas>

  <Hud counts={tally} {timeLeft} />

  <p class="sr-only" role="status">手前 {tally[1]}ひき、向かい {tally[2]}ひき</p>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .zone {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
  }

  .zone.p2 {
    top: 0;
    background: var(--dots), var(--zone-2);
  }

  .zone.p1 {
    bottom: 0;
    background: var(--dots), var(--zone-1);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* 虫が湧いてくる真ん中の巣 */
  .nest {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 70%;
    height: 7%;
    border-radius: 999px;
    background: radial-gradient(ellipse, #b98a5a, #8d6440 70%, transparent 71%);
    translate: -50% -50%;
    opacity: 0.55;
  }

  /* 終盤は巣が脈打ち、虫が一気に湧く合図にする */
  .nest.rush {
    opacity: 0.8;
    animation: throb 400ms ease-in-out infinite alternate;
  }

  @keyframes throb {
    to {
      scale: 1.06 1.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nest.rush {
      animation: none;
    }
  }
</style>
