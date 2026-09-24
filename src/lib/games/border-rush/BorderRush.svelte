<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import { capture } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import type { Player } from '$lib/player';
  import Orbs from './Orbs.svelte';
  import Pops, { type Pop } from './Pops.svelte';
  import RushCall from './RushCall.svelte';
  import {
    beginHold,
    createState,
    endHold,
    HOLD_MS,
    ORB_LIFE_MS,
    pop,
    RUSH_S,
    step,
    WIN_MARGIN,
    type Orb
  } from './engine';
  import { sounds } from './sounds';

  let { onfinish }: { onfinish: (winner: Player) => void } = $props();

  const game = $state(createState());
  const holding = $derived(Object.keys(game.holds).map(Number));
  const rush = $derived(game.elapsed >= RUSH_S);
  let pops = $state<Pop[]>([]);
  let popId = 0;

  function burst(x: number, y: number, color: string) {
    pops = [...pops.slice(-7), { id: ++popId, x, y, color }];
  }

  const colorOf = (by: Player) => (by === 1 ? 'var(--p1)' : 'var(--p2)');

  function take(orb: Orb, by: Player) {
    // 奪い合いの玉は境界線に乗っているので、消える前の境界の位置で弾けさせる
    const y = orb.owner === null ? game.border : orb.y;
    if (!pop(game, orb.id, by)) return;
    burst(orb.x, y, orb.owner === null ? 'var(--gold)' : colorOf(by));
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
    capture(event);
    beginHold(game, orb.id);
  }

  onMount(() =>
    animate((dt, now) => {
      for (const event of step(game, dt, now)) {
        if (event.type === 'pop') {
          sounds[event.kind]();
          burst(event.x, event.y, colorOf(event.by));
        } else {
          sfx.finish();
          onfinish(event.player);
        }
      }
    })
  );
</script>

<div
  class="field"
  class:rush
  style:--b={game.border}
  style:--hold="{HOLD_MS}ms"
  style:--life="{ORB_LIFE_MS}ms"
  style:--win="{WIN_MARGIN * 100}%"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>
  <!-- ここまで押し込めば勝ち -->
  <div class="finish p2"></div>
  <div class="finish p1"></div>

  <Orbs orbs={game.orbs} {holding} ongrab={grab} onrelease={(id) => endHold(game, id)} />
  <Pops {pops} />

  {#if rush}<RushCall />{/if}

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

  /* ラッシュのあいだは境界線を金色にして、押す力が強いことを見せる */
  .rush .zone.p1 {
    box-shadow:
      inset 0 6px 0 var(--gold),
      inset 0 12px 0 rgb(255 194 51 / 0.35);
  }

  .finish {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 4px dashed rgb(43 45 66 / 0.25);
    pointer-events: none;
  }

  .finish.p2 {
    top: var(--win);
  }

  .finish.p1 {
    bottom: var(--win);
  }

  @media (prefers-reduced-motion: reduce) {
    .zone {
      transition: none;
    }
  }
</style>
