<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import Pips from '$lib/components/Pips.svelte';
  import type { GameProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { sideOf } from '$lib/player';
  import { createState, GOAL, press, step, type FeintEvent } from './engine';
  import Glyph from './Glyph.svelte';
  import Hint from './Hint.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  const game = $state(createState());

  function play(events: FeintEvent[]) {
    for (const event of events) {
      if (event.type === 'flip') sounds.flip();
      else if (event.type === 'score') sounds.score();
      else if (event.type === 'fault') sounds.fault();
      else {
        sfx.finish();
        onfinish(event.player);
      }
    }
  }

  /** 押した位置の陣地だけ分かればよい。指は追わないが、回転と座標の変換は BoardInput に任せる */
  const input = new BoardInput({ down: (_event, _x, y) => play(press(game, sideOf(y))) });

  onMount(() => animate((dt) => play(step(game, dt))));
</script>

<div class="board" use:input.board role="application" aria-label="フェイントマスターの盤面">
  <div class="zone p2"></div>
  <div class="zone p1"></div>

  <div class="signal" class:live={game.phase === 'signal'}>
    {#if game.phase === 'signal'}
      {#key game.flips}
        <span class="token"><Glyph color={game.token.color} shape={game.token.shape} /></span>
      {/key}
    {:else}
      <span class="wait">？</span>
    {/if}
  </div>

  <Hint player={2} {game} />
  <Hint player={1} {game} />
  <Pips player={2} score={game.score[2]} goal={GOAL} corner />
  <Pips player={1} score={game.score[1]} goal={GOAL} corner />
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

  /* 境界線の真ん中に合図を出す。形は上下どちらから見ても判別できるものだけ使う */
  .signal {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: min(40vmin, 240px);
    aspect-ratio: 1;
    border: 6px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--lift);
    translate: -50% -50%;
    pointer-events: none;
  }

  .token {
    width: 62%;
    animation: pop 180ms var(--spring);
  }

  .wait {
    color: rgb(43 45 66 / 0.25);
    font-size: min(16vmin, 96px);
    font-weight: 800;
  }

  @keyframes pop {
    from {
      scale: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .token {
      animation: none;
    }
  }
</style>
