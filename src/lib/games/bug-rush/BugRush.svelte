<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { bugAt, counts, createState, step, tap } from './engine';
  import Hud from './Hud.svelte';
  import { paint } from './paint';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let board: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  const game = createState(1);
  let tally = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let timeLeft = $state(game.timeLeft);
  let lastSecond = Math.ceil(game.timeLeft);
  let size = { width: 1, height: 1 };

  function sync() {
    const next = counts(game);
    if (next[1] !== tally[1] || next[2] !== tally[2]) tally = next;
  }

  const input = new BoardInput({
    down: (_e, x, y) => {
      const bug = bugAt(game, x, y);
      const result = bug ? tap(game, bug.id) : null;
      if (result?.type === 'hit') sounds.hit();
      else if (result?.type === 'send') sounds.send();
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

  onMount(() => {
    const ctx = canvas.getContext('2d');
    const unobserve = input.observe(board, (aspect) => {
      game.aspect = aspect;
      resize();
    });
    const stop = animate((dt) => {
      for (const event of step(game, dt)) {
        if (event.type === 'land') sounds.land();
        else if (event.type === 'end') {
          sfx.finish();
          onfinish(event.winner);
        }
      }
      sync();
      if (ctx) paint(ctx, game.bugs, size.width, size.height);
      // 時間のバーは CSS で滑らかに縮めるので、書き換えは 0.1 秒刻みで足りる
      if (Math.abs(timeLeft - game.timeLeft) >= 0.1) timeLeft = game.timeLeft;
      const second = Math.ceil(game.timeLeft);
      if (second !== lastSecond && second >= 0 && second <= 5) sounds.count(second === 0);
      lastSecond = second;
    });
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
  aria-label="虫送りの盤面"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <div class="nest"></div>

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
</style>
