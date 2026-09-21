<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, wake } from '$lib/audio.svelte';
  import type { GameProps } from '$lib/games';
  import type { Player } from '$lib/player';
  import Blast from './Blast.svelte';
  import Bomb from './Bomb.svelte';
  import { createState, heat, moveHeld, step, throwBomb, tryCatch } from './engine';
  import { Fingers, velocity } from './fingers';
  import Meter from './Meter.svelte';
  import { sounds } from './sounds';

  let { onfinish }: GameProps = $props();

  let board: HTMLDivElement;
  let bombEl = $state<HTMLDivElement>();
  let meters = $state<Record<Player, number>>({ 1: 0, 2: 0 });
  let heldBy = $state<Player | null>(null);
  let hasBomb = $state(true);
  let boom = $state<{ id: number; side: Player; x: number; y: number } | null>(null);

  const game = createState(1);
  const fingers = new Fingers();
  /** 爆弾を持っている指の pointerId */
  let holder: number | null = null;
  let rect = { left: 0, top: 0, width: 1, height: 1 };
  let beat = 0;

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
  }

  function move(e: PointerEvent) {
    const p = toBoard(e);
    fingers.move(e.pointerId, p.x, p.y, e.timeStamp);
  }

  function up(e: PointerEvent) {
    const p = toBoard(e);
    const finger = fingers.up(e.pointerId, p.x, p.y, e.timeStamp);
    if (!finger || e.pointerId !== holder) return;
    holder = null;
    heldBy = null;
    // OS のジェスチャーで取り上げられた指は、はじいたことにしない
    const { vx, vy } = e.type === 'pointercancel' ? { vx: 0, vy: 0 } : velocity(finger.trail);
    if (throwBomb(game, vx, vy) > 1) sounds.throw();
  }

  function frame(dt: number) {
    if (holder !== null) {
      const finger = fingers.all.get(holder);
      if (finger) moveHeld(game, finger.x, finger.y);
    } else if (game.bomb) {
      for (const [id, finger] of fingers.all) {
        if (!tryCatch(game, finger.side, finger.x, finger.y)) continue;
        holder = id;
        heldBy = finger.side;
        moveHeld(game, finger.x, finger.y);
        sounds.catch();
        break;
      }
    }

    const event = step(game, dt);
    if (event?.type === 'boom') {
      holder = null;
      heldBy = null;
      boom = { id: (boom?.id ?? 0) + 1, side: event.side, x: event.x, y: event.y };
      sounds.boom();
    } else if (event?.type === 'win') {
      sfx.finish();
      onfinish(event.player);
    }
    draw(dt);
  }

  /** 毎フレーム動くものは DOM に直接書き、Svelte の更新は変化したときだけにする */
  function draw(dt: number) {
    const bomb = game.bomb;
    if (hasBomb !== !!bomb) hasBomb = !!bomb;
    for (const p of [1, 2] as const) if (Math.abs(meters[p] - game.meters[p]) > 0.002) meters[p] = game.meters[p];
    if (!bomb || !bombEl) return;

    const h = heat(bomb);
    const before = Math.floor(beat);
    beat += dt * (1.2 + 5 * h);
    if (Math.floor(beat) !== before) sounds.tick(h);
    const pulse = 1 + (0.04 + 0.1 * h) * Math.max(0, Math.sin((beat % 1) * Math.PI));
    bombEl.style.transform = `translate(${bomb.x * rect.width}px, ${bomb.y * rect.height}px) translate(-50%, -50%) scale(${pulse})`;
    bombEl.style.setProperty('--heat', h.toFixed(3));
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
    let last = performance.now();
    const loop = (now: number) => {
      // タブが裏に回った復帰直後などに、爆弾が一気にワープしないよう 1 フレームの長さを抑える
      frame(Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  });

  const percent = (v: number) => Math.floor(v * 10) * 10;
</script>

<div
  class="board"
  bind:this={board}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="application"
  aria-label="ばくだんリレーの盤面"
>
  <div class="zone p2"></div>
  <div class="zone p1"></div>

  {#if boom}
    {#key boom.id}
      <Blast side={boom.side} x={boom.x} y={boom.y} />
    {/key}
  {/if}

  <Meter player={2} value={meters[2]} filling={heldBy === 2} />
  <Meter player={1} value={meters[1]} filling={heldBy === 1} />
  <Bomb bind:el={bombEl} {heldBy} gone={!hasBomb} />

  <p class="sr-only" role="status">手前 {percent(meters[1])}パーセント、向かい {percent(meters[2])}パーセント</p>
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
    box-shadow: inset 0 3px 0 rgb(255 255 255 / 0.85);
  }
</style>
