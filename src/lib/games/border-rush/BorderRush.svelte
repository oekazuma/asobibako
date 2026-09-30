<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import { capture } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import type { GameProps } from '$lib/games';
  import type { Message } from '$lib/net/link';
  import type { Player } from '$lib/player';
  import Orbs from './Orbs.svelte';
  import Pops, { type Pop } from './Pops.svelte';
  import RushCall from './RushCall.svelte';
  import Zones from './Zones.svelte';
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
  import { apply, snapshot, type Popped, type Snap } from './net';
  import { sounds } from './sounds';

  let { onfinish, net }: GameProps = $props();
  /** 2 台で遊ぶときの子。ルールは親が進め、子は盤面を受け取って映し、自分の指を親へ送るだけ */
  const guest = $derived(net?.me === 2);

  const game = $state(createState());
  const holding = $derived(Object.keys(game.holds).map(Number));
  const rush = $derived(game.elapsed >= RUSH_S);
  let pops = $state<Pop[]>([]);
  let popId = 0;
  /** 親が次に子へ送る、このフレームで弾けた玉 */
  let outbox: Popped[] = [];

  const colorOf = (by: Player) => (by === 1 ? 'var(--p1)' : 'var(--p2)');

  function show(p: Popped) {
    pops = [...pops.slice(-7), { id: ++popId, x: p.x, y: p.y, color: p.color }];
    sounds[p.kind]();
  }

  function popped(p: Popped) {
    show(p);
    if (net) outbox.push(p);
  }

  /** 子へ今の盤面を送る。決着した指の操作ではすぐ結果画面に移って次のフレームが来ないので、決着でも呼ぶ */
  function flush() {
    net?.link.send({ t: 'snap', ...snapshot(game), pops: outbox });
    outbox = [];
  }

  function done(winner: Player) {
    sfx.finish();
    flush();
    onfinish(winner);
  }

  function take(orb: Orb, by: Player) {
    // 奪い合いの玉は境界線に乗っているので、消える前の境界の位置で弾けさせる
    const y = orb.owner === null ? game.border : orb.y;
    if (!pop(game, orb.id, by)) return;
    popped({ kind: orb.kind, x: orb.x, y, color: orb.owner === null ? 'var(--gold)' : colorOf(by) });
    if (game.winner !== null) done(game.winner);
  }

  function act(orb: Orb, by: Player) {
    if (orb.kind !== 'hold') take(orb, by);
    else if (orb.owner === by) beginHold(game, orb.id);
  }

  function grab(event: PointerEvent, orb: Orb, by: Player) {
    event.preventDefault();
    wake();
    if (net && by !== net.me) return;
    if (orb.kind === 'hold') capture(event);
    if (guest) net?.link.send({ t: 'grab', id: orb.id });
    else act(orb, by);
  }

  function release(id: number) {
    const owner = game.orbs.find((o) => o.id === id)?.owner;
    if (net && owner !== net.me) return;
    if (guest) net?.link.send({ t: 'release', id });
    else endHold(game, id);
  }

  function receive(message: Message) {
    if (message.t === 'snap') {
      const snap = message as unknown as Snap;
      if (snap.winner !== null && game.winner === null) sfx.finish();
      apply(game, snap);
      snap.pops.forEach(show);
      return;
    }
    const orb = game.orbs.find((o) => o.id === message.id);
    if (message.t === 'grab' && orb) act(orb, 2);
    else if (message.t === 'release' && orb?.owner === 2) endHold(game, orb.id);
  }

  onMount(() => {
    const unlisten = net?.link.on(receive);
    const stop = guest
      ? undefined
      : animate((dt, now) => {
          for (const event of step(game, dt, now)) {
            if (event.type === 'pop') popped({ kind: event.kind, x: event.x, y: event.y, color: colorOf(event.by) });
            else done(event.player);
          }
          if (net) flush();
        });
    return () => {
      unlisten?.();
      stop?.();
    };
  });
</script>

<div
  class="field"
  style:--b={game.border}
  style:--hold="{HOLD_MS}ms"
  style:--life="{ORB_LIFE_MS}ms"
  style:--win="{WIN_MARGIN * 100}%"
>
  <Zones {rush} />

  <Orbs orbs={game.orbs} {holding} ongrab={grab} onrelease={release} />
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
</style>
