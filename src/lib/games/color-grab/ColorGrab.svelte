<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import { Fingers } from '$lib/fingers';
  import type { GameProps } from '$lib/games';
  import type { Player } from '$lib/player';
  import Chip from './Chip.svelte';
  import { BAND, createState, drop, grab, moveChip, step } from './engine';
  import { NAME } from './palette';
  import Pips from './Pips.svelte';
  import { sounds } from './sounds';
  import Target from './Target.svelte';

  let { onfinish }: GameProps = $props();

  let board: HTMLDivElement;
  const game = $state(createState(1, performance.now()));
  let flash = $state<{ id: number; player: Player; good: boolean } | null>(null);

  const fingers = new Fingers();
  let rect = { left: 0, top: 0, width: 1, height: 1 };

  const toBoard = (e: PointerEvent) => ({
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height
  });

  function down(e: PointerEvent) {
    e.preventDefault();
    wake();
    try {
      board.setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントでは捕捉できないが、指の追跡自体は続けられる
    }
    const p = toBoard(e);
    fingers.down(e.pointerId, p.x, p.y, e.timeStamp);
    const id = Number((e.target as HTMLElement).closest<HTMLElement>('[data-chip]')?.dataset.chip);
    if (id && grab(game, id, e.pointerId)) sounds.grab();
  }

  function move(e: PointerEvent) {
    const p = toBoard(e);
    fingers.move(e.pointerId, p.x, p.y, e.timeStamp);
  }

  function up(e: PointerEvent) {
    const p = toBoard(e);
    fingers.up(e.pointerId, p.x, p.y, e.timeStamp);
    const chip = game.chips.find((c) => c.heldBy === e.pointerId);
    if (!chip) return;
    moveChip(game, chip.id, p.x, p.y);
    const result = drop(game, chip.id);
    if (result?.type === 'claim') {
      flash = { id: (flash?.id ?? 0) + 1, player: result.player, good: result.good };
      if (result.good) sounds.good();
      else sounds.bad();
    } else if (result?.type === 'win') {
      sfx.finish();
      onfinish(result.player);
    }
  }

  onMount(() => {
    const measure = () => {
      rect = board.getBoundingClientRect();
      game.aspect = rect.width / rect.height;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);

    let raf = 0;
    const loop = (now: number) => {
      for (const chip of game.chips) {
        if (chip.heldBy === null) continue;
        const finger = fingers.all.get(chip.heldBy);
        if (finger) moveChip(game, chip.id, finger.x, finger.y);
      }
      if (step(game, now)?.type === 'target') sounds.target();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  });
</script>

<div
  class="board"
  bind:this={board}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="application"
  aria-label="いろとりの盤面"
  style:--band-top="{BAND[0] * 100}%"
  style:--band-height="{(BAND[1] - BAND[0]) * 100}%"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <div class="band"></div>

  {#if flash}
    {#key flash.id}
      <div class="flash p{flash.player}" class:bad={!flash.good}></div>
    {/key}
  {/if}

  <Target color={game.target} />

  {#each game.chips as chip (chip.id)}
    <Chip {chip} />
  {/each}

  <Pips player={2} score={game.scores[2]} />
  <Pips player={1} score={game.scores[1]} />

  <p class="sr-only" role="status">
    お題は{NAME[game.target]}。手前 {game.scores[1]}点、向かい {game.scores[2]}点
  </p>
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
    background: var(--zone-2);
  }

  .zone.p1 {
    bottom: 0;
    background: var(--zone-1);
  }

  .band {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--band-top);
    height: var(--band-height);
    border-block: 2px dashed rgb(255 255 255 / 0.35);
    background: rgb(255 255 255 / 0.06);
  }

  .flash {
    position: absolute;
    left: 0;
    right: 0;
    height: calc(50% - var(--band-height) / 2);
    background: #fff;
    animation: flash 500ms ease-out forwards;
    pointer-events: none;
  }

  .flash.p2 {
    top: 0;
  }

  .flash.p1 {
    bottom: 0;
  }

  .flash.bad {
    background: #ef4444;
  }

  @keyframes flash {
    from {
      opacity: 0.35;
    }
    to {
      opacity: 0;
    }
  }
</style>
