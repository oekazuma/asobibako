<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import { velocity } from '$lib/fingers';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import Blast from './Blast.svelte';
  import Bomb from './Bomb.svelte';
  import { createState, heat, moveHeld, step, throwBomb, tryCatch } from './engine';
  import Meter from './Meter.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let bombEl = $state<HTMLDivElement>();
  let meters = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let heldBy = $state<Player | null>(null);
  let hasBomb = $state(true);
  let boom = $state<{ id: number; side: Player; x: number; y: number } | null>(null);
  let board: HTMLDivElement;

  const game = createState(1);
  /** 爆弾を持っている指の pointerId */
  let holder: number | null = null;
  let beat = 0;

  const input = new BoardInput({
    up: (e, finger) => {
      if (e.pointerId !== holder) return;
      holder = null;
      heldBy = null;
      // OS のジェスチャーで取り上げられた指は、はじいたことにしない
      const { vx, vy } = e.type === 'pointercancel' ? { vx: 0, vy: 0 } : velocity(finger.trail);
      if (throwBomb(game, vx, vy) > 1) sounds.throw();
    }
  });

  function frame(dt: number) {
    if (holder !== null) {
      const finger = input.fingers.all.get(holder);
      if (finger) moveHeld(game, finger.x, finger.y);
    } else if (game.bomb) {
      for (const [id, finger] of input.fingers.all) {
        if (!tryCatch(game, finger.side, finger.x, finger.y)) continue;
        holder = id;
        heldBy = finger.side;
        moveHeld(game, finger.x, finger.y);
        sounds.catch();
        break;
      }
    }

    const event = step(game, dt);
    if (event?.type === 'boom') {
      holder = null;
      heldBy = null;
      boom = { id: (boom?.id ?? 0) + 1, side: event.side, x: event.x, y: event.y };
      sounds.boom();
      shake();
    } else if (event?.type === 'win') {
      sfx.finish();
      onfinish(event.player);
    }
    draw(dt);
  }

  /** 毎フレーム動くものは DOM に直接書き、Svelte の更新は変化したときだけにする */
  function draw(dt: number) {
    const bomb = game.bomb;
    if (hasBomb !== !!bomb) hasBomb = !!bomb;
    for (const p of [1, 2] as const) if (Math.abs(meters[p] - game.meters[p]) > 0.002) meters[p] = game.meters[p];
    if (!bomb || !bombEl) return;

    const h = heat(bomb);
    const before = Math.floor(beat);
    beat += dt * (1.2 + 5 * h);
    if (Math.floor(beat) !== before) sounds.tick(h);
    const pulse = 1 + (0.04 + 0.1 * h) * Math.max(0, Math.sin((beat % 1) * Math.PI));
    const [px, py] = input.px(bomb.x, bomb.y);
    bombEl.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) scale(${pulse})`;
    bombEl.style.setProperty('--heat', h.toFixed(3));
  }

  function shake() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    board.animate(
      [0, 10, -8, 6, -3, 0].map((px, i) => ({ translate: `${i % 2 ? px : -px}px ${px}px` })),
      { duration: 380, easing: 'ease-out' }
    );
  }

  onMount(() => animate(frame));

  const percent = (v: number) => Math.floor(v * 10) * 10;
</script>

<div
  bind:this={board}
  class="board"
  use:input.board={(aspect) => (game.aspect = aspect)}
  role="application"
  aria-label="ばくだんリレーの盤面"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>

  {#if boom}
    {#key boom.id}
      <Blast side={boom.side} x={boom.x} y={boom.y} />
    {/key}
  {/if}

  <Meter player={2} value={meters[2]} filling={heldBy === 2} />
  <Meter player={1} value={meters[1]} filling={heldBy === 1} />
  <Bomb bind:el={bombEl} {heldBy} gone={!hasBomb} />

  <p class="sr-only" role="status">手前 {percent(meters[1])}パーセント、向かい {percent(meters[2])}パーセント</p>
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
    box-shadow:
      inset 0 6px 0 #fff,
      inset 0 10px 0 rgb(43 45 66 / 0.08);
  }
</style>
