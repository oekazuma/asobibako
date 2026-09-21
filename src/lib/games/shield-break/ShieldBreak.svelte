<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import type { GameProps } from '$lib/games';
  import { Gestures } from '$lib/gestures';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { choose, createState, step, type ShieldEvent } from './engine';
  import Side from './Side.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let board: HTMLDivElement;
  const game = $state(createState());
  /** 拍と「エネルギーがない」の回数。表示の演出をやり直すきっかけに使う */
  let beats = $state(0);
  const nudges = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  const guarding = $state<Record<Player, boolean>>({ 1: false, 2: false });

  const gestures = new Gestures((player, g) => {
    if (g.kind === 'tap') act(player, 'charge');
    else if (g.kind === 'swipe' && g.dir === 'up') act(player, 'attack');
  });
  const input = new BoardInput({
    down: (event, x, y) => gestures.down(event.pointerId, x, y, event.timeStamp),
    up: (event, _finger, x, y) => gestures.up(event.pointerId, x, y, event.timeStamp)
  });

  function act(player: Player, action: 'charge' | 'attack') {
    const events = choose(game, player, action);
    if (events.length === 0) sounds.choose();
    play(events);
  }

  function play(events: ShieldEvent[]) {
    for (const event of events) {
      if (event.type === 'empty') {
        nudges[event.player] += 1;
        sounds.empty();
      } else if (event.type === 'win') {
        sfx.finish();
        onfinish(event.player);
      } else {
        beats += 1;
        sounds.beat();
        const { act, hit, blocked } = event.outcome;
        if (hit[1] || hit[2]) sounds.hit();
        else if (blocked[1] || blocked[2]) sounds.block();
        else if (act[1] === 'attack' && act[2] === 'attack') sounds.clash();
        else if (act[1] === 'charge' || act[2] === 'charge') sounds.charge();
      }
    }
  }

  onMount(() => {
    const unobserve = input.observe(board, () => {});
    const stop = animate((dt, now) => {
      gestures.tick(now, input.fingers.all);
      const held = { 1: false, 2: false };
      for (const finger of input.fingers.all.values()) held[finger.side] = true;
      if (guarding[1] !== held[1]) guarding[1] = held[1];
      if (guarding[2] !== held[2]) guarding[2] = held[2];
      const before = game.timer;
      play(step(game, dt, held));
      if (before > game.beat / 2 && game.timer <= game.beat / 2) sounds.tick();
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
  aria-label="シールドブレイクの盤面"
>
  <Side player={2} {game} {beats} nudge={nudges[2]} guarding={guarding[2]} />
  <Side player={1} {game} {beats} nudge={nudges[1]} guarding={guarding[1]} />

  <!-- 拍の輪。縮みきった瞬間に 2 人の行動を比べる -->
  <div class="metronome" aria-hidden="true">
    <span class="ring" style:scale={Math.max(0, Math.min(1, game.timer / game.beat))}></span>
    <span class="core"></span>
  </div>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .metronome {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 140px;
    aspect-ratio: 1;
    translate: -50% -50%;
    pointer-events: none;
  }

  .ring,
  .core {
    grid-area: 1 / 1;
    border-radius: 50%;
  }

  .ring {
    width: 100%;
    height: 100%;
    border: 6px solid var(--gold);
  }

  .core {
    width: 34px;
    height: 34px;
    border: 4px solid #fff;
    background: var(--gold);
    box-shadow: var(--lift);
  }
</style>
