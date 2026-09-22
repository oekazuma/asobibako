<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import Pips from '$lib/components/Pips.svelte';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import { createState, GOAL, MALLET_R, MALLETS_PER_PLAYER, PUCK_R, step, updateMallets } from './engine';
  import Rink from './Rink.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let puckEl: HTMLDivElement;
  /** マレットの要素は 1 人ぶん MALLETS_PER_PLAYER 個を先に置いておき、毎フレーム位置と表示だけ書き換える */
  const malletEls: Record<Player, HTMLDivElement[]> = { 1: [], 2: [] };
  let scores = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let goals = $state(0);

  const game = createState(1, Math.random() < 0.5 ? 1 : 2);
  const input = new BoardInput();
  let lastWall = 0;

  function frame(dt: number, now: number) {
    const fingers = Array.from(input.fingers.all, ([id, f]) => ({ id, side: f.side, x: f.x, y: f.y }));
    updateMallets(game, fingers, dt);
    for (const event of step(game, dt)) {
      if (event.type === 'hit') sounds.hit(event.speed);
      else if (event.type === 'wall' && now - lastWall > 60) {
        lastWall = now;
        sounds.wall();
      } else if (event.type === 'goal') {
        scores = { ...game.scores };
        goals += 1;
        sounds.goal();
      } else if (event.type === 'win') {
        sfx.finish();
        onfinish(event.player);
      }
    }
    draw();
  }

  const place = (el: HTMLElement, x: number, y: number) => {
    const [px, py] = input.px(x, y);
    el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
  };

  function draw() {
    place(puckEl, game.puck.x, game.puck.y);
    puckEl.classList.toggle('serving', game.pause > 0);
    const used: Record<Player, number> = { 1: 0, 2: 0 };
    for (const mallet of game.mallets) {
      const el = malletEls[mallet.player][used[mallet.player]++];
      place(el, mallet.x, mallet.y);
      el.hidden = false;
    }
    for (const p of [1, 2] as const) for (let i = used[p]; i < MALLETS_PER_PLAYER; i++) malletEls[p][i].hidden = true;
  }

  onMount(() => animate(frame));
</script>

<div
  class="board"
  use:input.board={(aspect) => (game.aspect = aspect)}
  role="application"
  aria-label="ホッケーの盤面"
  style:--puck="{PUCK_R * 200}%"
  style:--mallet="{MALLET_R * 200}%"
>
  <Rink flash={goals} />

  {#each [1, 2] as const as player (player)}
    {#each Array.from({ length: MALLETS_PER_PLAYER }, (_, i) => i) as i (i)}
      <div class="mallet p{player}" bind:this={malletEls[player][i]} hidden></div>
    {/each}
  {/each}
  <div class="puck" bind:this={puckEl}></div>

  <Pips player={2} score={scores[2]} goal={GOAL} corner />
  <Pips player={1} score={scores[1]} goal={GOAL} corner />

  <p class="sr-only" role="status">手前 {scores[1]}点、向かい {scores[2]}点</p>
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .puck,
  .mallet {
    position: absolute;
    left: 0;
    top: 0;
    aspect-ratio: 1;
    border-radius: 50%;
    pointer-events: none;
    will-change: transform;
  }

  .puck {
    height: var(--puck);
    border: 3px solid #fff;
    background: radial-gradient(circle at 35% 30%, #6d7390, #2b2d42 62%);
    box-shadow: 0 4px 0 rgb(43 45 66 / 0.25);
  }

  /* 得点のあと、次のパックが動き出すまでは点滅させて「まだ触れない」ことを伝える */
  .puck:global(.serving) {
    animation: blink 300ms steps(2) infinite;
  }

  .mallet {
    height: var(--mallet);
    border: 5px solid #fff;
    box-shadow:
      inset 0 0 0 10px rgb(0 0 0 / 0.12),
      0 6px 0 rgb(43 45 66 / 0.22);
  }

  .mallet.p1 {
    background: var(--p1);
  }

  .mallet.p2 {
    background: var(--p2);
  }

  @keyframes blink {
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .puck:global(.serving) {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
