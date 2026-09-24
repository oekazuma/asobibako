<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import Icon from '$lib/components/Icon.svelte';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { CAT_R, CHEESE_R, createState, MOUSE_R, step, STICK_R, updateSticks } from './engine';
  import Critter from './Critter.svelte';
  import Hud from './Hud.svelte';
  import Room from './Room.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  const game = createState(1, Math.random() < 0.5 ? 1 : 2);
  const input = new BoardInput();

  let cheeseEl: HTMLDivElement;
  const runnerEls: Record<Player, HTMLDivElement | undefined> = { 1: undefined, 2: undefined };
  const faceEls: Record<Player, HTMLDivElement | undefined> = { 1: undefined, 2: undefined };
  const stickEls: Record<Player, HTMLDivElement | undefined> = { 1: undefined, 2: undefined };
  const knobEls: Record<Player, HTMLDivElement | undefined> = { 1: undefined, 2: undefined };

  let view = $state(snapshot());
  let timeLeft = $state(game.timeLeft);
  let lastSecond = Math.ceil(game.timeLeft);

  function snapshot() {
    return { phase: game.phase, cat: game.cat, round: game.round, caught: game.caught, scores: { ...game.scores } };
  }

  function frame(dt: number) {
    // 置いてすぐ動かすと同じフレームに down と move が入るので、スティックの中心は軌跡の最初（置いた位置）から取る
    const fingers = Array.from(input.fingers.all, ([id, f]) => {
      const [first] = f.trail;
      return { id, side: f.side, x: f.x, y: f.y, ox: first.x, oy: first.y };
    });
    updateSticks(game, fingers);
    const events = step(game, dt);
    for (const event of events) {
      if (event.type === 'cheese') sounds.cheese();
      else if (event.type === 'caught') sounds.caught();
      else if (event.type === 'escape') sounds.escape();
      else if (event.type === 'round') sounds.swap();
      else if (event.type === 'go') sfx.start();
      else if (event.type === 'win') {
        sfx.finish();
        onfinish(event.player);
      }
    }
    if (events.length) view = snapshot();
    if (Math.abs(timeLeft - game.timeLeft) >= 0.1 || game.timeLeft === 0) timeLeft = game.timeLeft;
    const second = Math.ceil(game.timeLeft);
    if (game.phase === 'play' && second !== lastSecond && second <= 3) sounds.count();
    lastSecond = second;
    draw();
  }

  const place = (el: HTMLElement | undefined, x: number, y: number) => {
    if (!el) return;
    const [px, py] = input.px(x, y);
    el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
  };

  function draw() {
    place(cheeseEl, game.cheese.x, game.cheese.y);
    for (const p of [1, 2] as const) {
      const r = game.runners[p];
      place(runnerEls[p], r.x, r.y);
      if (faceEls[p]) faceEls[p].style.rotate = `${r.face}deg`;
      const stick = game.sticks[p];
      if (stickEls[p]) stickEls[p].hidden = !stick;
      if (knobEls[p]) knobEls[p].hidden = !stick;
      if (!stick) continue;
      place(stickEls[p], stick.ox, stick.oy);
      place(knobEls[p], stick.x, stick.y);
    }
  }

  onMount(() => animate(frame));
</script>

<div
  class="board"
  use:input.board={(aspect) => (game.aspect = aspect)}
  role="application"
  aria-label="ネコとネズミの盤面"
  style:--cat="{CAT_R * 360}%"
  style:--mouse="{MOUSE_R * 360}%"
  style:--cheese="{CHEESE_R * 260}%"
  style:--stick="{STICK_R * 200}%"
>
  <Room />
  <div class="cheese" hidden={view.phase !== 'play'} bind:this={cheeseEl}><Icon name="cheese" size="100%" /></div>

  {#each [1, 2] as const as player (player)}
    <div class="stick p{player}" bind:this={stickEls[player]} hidden></div>
    <div class="knob p{player}" bind:this={knobEls[player]} hidden></div>
  {/each}

  {#each [1, 2] as const as player (player)}
    {@const cat = view.cat === player}
    <div class="runner p{player}" class:cat bind:this={runnerEls[player]}>
      <div class="face" bind:this={faceEls[player]}><Critter kind={cat ? 'cat' : 'mouse'} /></div>
    </div>
  {/each}

  <Hud {...view} {timeLeft} />
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    /* 板張りの床。板の継ぎ目と、1 枚おきの色むら */
    background:
      repeating-linear-gradient(90deg, rgb(122 74 34 / 0.28) 0 2px, transparent 2px 12.5%),
      repeating-linear-gradient(90deg, #e6bd86 0 12.5%, #ddb077 12.5% 25%);
  }

  .cheese,
  .runner,
  .stick,
  .knob {
    position: absolute;
    left: 0;
    top: 0;
    aspect-ratio: 1;
    pointer-events: none;
    will-change: transform;
  }

  .cheese {
    height: var(--cheese);
    filter: drop-shadow(0 3px 0 rgb(43 45 66 / 0.2));
  }

  /* 真ん中の時間の線より上に出す */
  .runner {
    z-index: 1;
    height: var(--mouse);
    filter: drop-shadow(0 4px 2px rgb(60 36 16 / 0.35));
  }

  .runner.cat {
    height: var(--cat);
  }

  .p1 {
    --c: var(--p1);
  }

  .p2 {
    --c: var(--p2);
  }

  .face {
    position: absolute;
    inset: 0;
  }

  /* 指を置いた場所に出るスティックの輪と、いまの指の位置 */
  .stick {
    height: var(--stick);
    border: 3px dashed var(--c);
    border-radius: 50%;
    opacity: 0.5;
  }

  .knob {
    height: calc(var(--stick) * 0.45);
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--c);
    opacity: 0.6;
  }
</style>
