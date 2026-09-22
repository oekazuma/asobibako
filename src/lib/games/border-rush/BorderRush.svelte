<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import Orbs from './Orbs.svelte';
  import { beginHold, createState, endHold, HOLD_MS, ORB_LIFE_MS, pop, step, type Orb } from './engine';
  import { sounds } from './sounds';

  let { onfinish }: { onfinish: (winner: Player) => void } = $props();

  const game = $state(createState());
  const holding = $derived(Object.keys(game.holds).map(Number));

  function take(orb: Orb, by: Player) {
    if (!pop(game, orb.id, by)) return;
    sounds[orb.kind]();
    if (game.winner !== null) {
      sfx.finish();
      onfinish(game.winner);
    }
  }

  function grab(event: PointerEvent, orb: Orb, by: Player) {
    event.preventDefault();
    wake();
    if (orb.kind !== 'hold') return take(orb, by);
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // 合成イベントなどで捕捉できなくても長押し自体は成立させる
    }
    beginHold(game, orb.id);
  }

  onMount(() =>
    animate((dt, now) => {
      for (const event of step(game, dt, now)) {
        if (event.type === 'pop') sounds[event.kind]();
        else {
          sfx.finish();
          onfinish(event.player);
        }
      }
    })
  );
</script>

<div class="field" style:--b={game.border} style:--hold="{HOLD_MS}ms" style:--life="{ORB_LIFE_MS}ms">
  <div class="zone p2"></div>
  <div class="zone p1"></div>

  <Orbs orbs={game.orbs} {holding} ongrab={grab} onrelease={(id) => endHold(game, id)} />

  <p class="sr-only" role="status">
    下側の陣地 {Math.round((1 - game.border) * 100)}パーセント
  </p>
</div>

<style>
  .field {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .zone {
    position: absolute;
    inset: 0;
    transition: transform 160ms ease-out;
  }

  .zone.p2 {
    background: var(--dots), var(--zone-2);
    transform: translateY(calc((var(--b) - 1) * 100%));
  }

  .zone.p1 {
    background: var(--dots), var(--zone-1);
    transform: translateY(calc(var(--b) * 100%));
    /* 境界線は太い白線に薄い影を添えて、明るい陣地の上でもはっきり見せる */
    box-shadow:
      inset 0 6px 0 #fff,
      inset 0 10px 0 rgb(43 45 66 / 0.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .zone {
      transition: none;
    }
  }
</style>
