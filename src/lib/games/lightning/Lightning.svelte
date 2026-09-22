<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { sfx } from '$lib/audio.svelte';
  import { BoardInput } from '$lib/board-input';
  import Pips from '$lib/components/Pips.svelte';
  import type { GameProps } from '$lib/games';
  import { Gestures } from '$lib/gestures';
  import { animate } from '$lib/loop';
  import { sideOf } from '$lib/player';
  import Card from './Card.svelte';
  import { answer, createState, GOAL, step, touch, type LightningEvent } from './engine';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let board: HTMLDivElement;
  const game = $state(createState());

  const gestures = new Gestures((player, g) => play(answer(game, player, g.kind === 'swipe' ? g.dir : g.kind)));
  const input = new BoardInput({
    down: (event, x, y) => {
      gestures.down(event.pointerId, x, y, event.timeStamp);
      play(touch(game, sideOf(y)));
    },
    up: (event, _finger, x, y) => gestures.up(event.pointerId, x, y, event.timeStamp)
  });

  function play(events: LightningEvent[]) {
    for (const event of events) {
      if (event.type === 'go') {
        // 合図の前から置いていた指は、指示への答えとして数えない
        gestures.settle();
        sounds.go();
      } else if (event.type === 'score') sounds.score();
      else if (event.type === 'miss' || event.type === 'early') sounds.miss();
      else if (event.type === 'timeout') sounds.timeout();
      else if (event.type === 'win') {
        sfx.finish();
        onfinish(event.player);
      }
    }
  }

  onMount(() => {
    const unobserve = input.observe(board, () => {});
    const stop = animate((dt, now) => {
      play(step(game, dt));
      gestures.tick(now, input.fingers.all);
    });
    return () => {
      stop();
      unobserve();
    };
  });
</script>

<div
  class="board"
  class:go={game.phase === 'go'}
  bind:this={board}
  onpointerdown={input.down}
  onpointermove={input.move}
  onpointerup={input.up}
  onpointercancel={input.up}
  role="application"
  aria-label="ライトニングの盤面"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <div class="bolt" aria-hidden="true"><Icon name="bolt" size="36px" /></div>

  <Card player={2} {game} />
  <Card player={1} {game} />
  <Pips player={2} score={game.score[2]} goal={GOAL} />
  <Pips player={1} score={game.score[1]} goal={GOAL} />
</div>

<style>
  .board {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
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

  /* 境界線の真ん中の稲妻。指示が出ている間だけ光る */
  .bolt {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 64px;
    aspect-ratio: 1;
    border: 4px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--lift);
    font-size: 32px;
    translate: -50% -50%;
    filter: grayscale(1);
    opacity: 0.6;
    transition:
      scale 200ms var(--spring),
      opacity 120ms;
  }

  .go .bolt {
    background: var(--gold);
    filter: none;
    opacity: 1;
    scale: 1.25;
  }
</style>
