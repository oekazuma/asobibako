<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import type { Player } from '$lib/player';
  import Orbs from './Orbs.svelte';
  import { createState, expire, HOLD_MS, ORB_LIFE_MS, pop, spawnOrb, type Orb } from './engine';

  let { onfinish }: { onfinish: (winner: Player) => void } = $props();

  const MAX_PER_PLAYER = 3;
  const SPAWN_MS = 340;
  const CONTEST_CHANCE = 0.16;

  const game = $state(createState());
  let holding = $state<number[]>([]);

  const holdTimers: Record<number, ReturnType<typeof setTimeout>> = {};

  function addOrb(owner: Player | null) {
    const kind = owner === null ? 'contest' : Math.random() < 0.28 ? 'hold' : 'tap';
    spawnOrb(game, kind, owner, Date.now());
  }

  function tick() {
    if (game.winner !== null) return;
    expire(game, Date.now());
    for (const p of [1, 2] as const) {
      if (game.orbs.filter((o) => o.owner === p).length < MAX_PER_PLAYER) addOrb(p);
    }
    if (!game.orbs.some((o) => o.owner === null) && Math.random() < CONTEST_CHANCE) addOrb(null);
  }

  function take(orb: Orb, by: Player) {
    if (!pop(game, orb.id, by)) return;
    sfx[orb.kind]();
    if (game.winner !== null) {
      sfx.finish();
      onfinish(game.winner);
    }
  }

  function startHold(orb: Orb, by: Player) {
    if (orb.id in holdTimers) return;
    holding.push(orb.id);
    holdTimers[orb.id] = setTimeout(() => {
      endHold(orb.id);
      take(orb, by);
    }, HOLD_MS);
  }

  function endHold(id: number) {
    if (id in holdTimers) {
      clearTimeout(holdTimers[id]);
      delete holdTimers[id];
    }
    const i = holding.indexOf(id);
    if (i >= 0) holding.splice(i, 1);
  }

  function grab(event: PointerEvent, orb: Orb, by: Player) {
    event.preventDefault();
    wake();
    if (orb.kind === 'hold') {
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // 合成イベントなどで捕捉できなくても長押し自体は成立させる
      }
      startHold(orb, by);
    } else {
      take(orb, by);
    }
  }

  // $effect だと tick() が game を読むぶん依存に入り、玉が出るたび interval が張り直される
  onMount(() => {
    tick();
    const interval = setInterval(tick, SPAWN_MS);
    return () => {
      clearInterval(interval);
      for (const id of Object.keys(holdTimers)) endHold(Number(id));
    };
  });
</script>

<div class="field" style:--b={game.border} style:--hold="{HOLD_MS}ms" style:--life="{ORB_LIFE_MS}ms">
  <div class="zone p2"></div>
  <div class="zone p1"></div>

  <Orbs orbs={game.orbs} {holding} ongrab={grab} onrelease={endHold} />

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
