<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { CATCH_Y, createState, step } from './engine';
  import Fish from './Fish.svelte';
  import { sounds } from './sounds';
  import Tension from './Tension.svelte';

  let { onfinish }: GameProps = $props();

  let fishEl = $state<HTMLDivElement>();
  const lines: Record<Player, SVGLineElement | undefined> = { 1: undefined, 2: undefined };
  let tension = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let snapped = $state<Record<Player, boolean>>({ 1: false, 2: false });
  let thrashing = $state(false);

  const game = createState();
  const input = new BoardInput();
  /** 前のフレームの指の y。手前へ動いた分だけ糸をたぐる */
  const lastY: Record<number, number> = {};
  const reeled: Record<Player, number> = { 1: 0, 2: 0 };

  function frame(dt: number) {
    const pulls: Record<Player, number> = { 1: 0, 2: 0 };
    for (const [id, finger] of input.fingers.all) {
      const dy = finger.y - (lastY[id] ?? finger.y);
      lastY[id] = finger.y;
      if (finger.side === 1 && dy > 0) pulls[1] += dy;
      if (finger.side === 2 && dy < 0) pulls[2] -= dy;
    }
    for (const key of Object.keys(lastY)) if (!input.fingers.all.has(Number(key))) delete lastY[Number(key)];

    for (const event of step(game, dt, pulls)) {
      if (event.type === 'thrash') sounds.thrash();
      else if (event.type === 'snap') sounds.snap();
      else if (event.type === 'catch') {
        sfx.finish();
        onfinish(event.player);
      }
    }
    for (const p of [1, 2] as const) {
      reeled[p] += game.stunned[p] > 0 ? 0 : pulls[p];
      if (reeled[p] > 0.06) {
        reeled[p] = 0;
        sounds.reel(p);
      }
    }
    draw();
  }

  /** 毎フレーム動くものは DOM に直接書き、Svelte の更新は変化したときだけにする */
  function draw() {
    const [cx, cy] = input.px(0.5, game.fish.y);
    const [, bottom] = input.px(0.5, 1);
    if (fishEl) fishEl.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    lines[1]?.setAttribute('y1', String(cy));
    lines[2]?.setAttribute('y1', String(cy));
    lines[1]?.setAttribute('y2', String(bottom));
    for (const p of [1, 2] as const) {
      if (Math.abs(tension[p] - game.tension[p]) > 0.01) tension[p] = game.tension[p];
      const cut = game.stunned[p] > 0;
      if (snapped[p] !== cut) snapped[p] = cut;
    }
    if (thrashing !== game.thrash > 0) thrashing = game.thrash > 0;
  }

  onMount(() => animate(frame));
</script>

<div
  class="board"
  use:input.board={() => draw()}
  role="application"
  aria-label="フィッシュプルの盤面"
  style:--catch1="{(1 - CATCH_Y[1]) * 100}%"
  style:--catch2="{CATCH_Y[2] * 100}%"
>
  <div class="water"></div>
  <div class="net p2"></div>
  <div class="net p1"></div>

  <svg class="lines" aria-hidden="true">
    <line bind:this={lines[2]} class:taut={tension[2] > 0.7} class:cut={snapped[2]} x1="50%" x2="50%" y2="0" />
    <line bind:this={lines[1]} class:taut={tension[1] > 0.7} class:cut={snapped[1]} x1="50%" x2="50%" />
  </svg>

  <Fish bind:el={fishEl} {thrashing} />
  <Tension player={2} value={tension[2]} snapped={snapped[2]} />
  <Tension player={1} value={tension[1]} snapped={snapped[1]} />

  <p class="sr-only" role="status">{thrashing ? '魚が暴れている' : ''}</p>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  /* 池。両端は各プレイヤーの色に寄せ、真ん中は水の色 */
  .water {
    position: absolute;
    inset: 0;
    background:
      var(--dots), linear-gradient(to bottom, var(--p2-soft), #b9ecff 35%, #8fdcfb 50%, #b9ecff 65%, var(--p1-soft));
  }

  /* 手前のこの線を越えたら釣り上げ。網の目で「ここまで引けば勝ち」を見せる */
  .net {
    position: absolute;
    left: 0;
    right: 0;
    background:
      repeating-linear-gradient(45deg, rgb(255 255 255 / 0.55) 0 3px, transparent 3px 18px),
      repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.55) 0 3px, transparent 3px 18px);
  }

  .net.p2 {
    top: 0;
    height: var(--catch2);
    border-bottom: 5px dashed var(--p2);
  }

  .net.p1 {
    bottom: 0;
    height: var(--catch1);
    border-top: 5px dashed var(--p1);
  }

  .lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  line {
    stroke: #fff;
    stroke-width: 4;
    stroke-linecap: round;
    filter: drop-shadow(0 2px 0 rgb(43 45 66 / 0.2));
  }

  /* 張りつめたら赤、切れたら消す */
  .taut {
    stroke: var(--p2);
  }

  .cut {
    opacity: 0;
  }
</style>
