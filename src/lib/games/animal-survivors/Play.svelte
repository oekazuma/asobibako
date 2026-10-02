<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import type { AnimalId } from './animals';
  import { draw, viewSize, type ViewSize } from './draw';
  import { Effects } from './effects';
  import { keyVector, padVector, pick, stickVector } from './input';
  import { PendingPause, canPause } from './pause';
  import Pause from './Pause.svelte';
  import PromptLayer from './PromptLayer.svelte';
  import { Prompts } from './prompts.svelte';
  import Stick from './Stick.svelte';
  import type { Ranks } from './upgrades';
  import { createWorld, step, summary, type World } from './world';

  let {
    animal,
    ranks,
    onover,
    onend,
    onrestart
  }: {
    animal: AnimalId;
    ranks: Ranks;
    onover: (w: World) => void;
    onend: () => void;
    onrestart: () => void;
  } = $props();

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  let canvas: HTMLCanvasElement;
  let probe: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let view: ViewSize = { scale: 2, w: 260, h: 380 };
  /** HUD を書きはじめる高さ（仮想ドット）。シェルの隅のボタンの下 */
  let top = 24;
  // svelte-ignore state_referenced_locally
  const world = createWorld(animal, Date.now() % 2 ** 31, { w: view.w, h: view.h }, ranks);
  const fx = new Effects();
  const keys = new SvelteSet<string>();
  const prompts = new Prompts(world);
  let stick = $state<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  let menu = $state(false);
  const later = new PendingPause();
  /** 一時停止を開いたときに残っていたスティックの指（離したときの合成 click を確かめで受けないため） */
  let menuFinger = $state<number | null>(null);
  let hidden = false;
  let ended = $state(false);
  let now = 0;
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!stick && !prompts.busy) stick = { id: event.pointerId, x, y, dx: 0, dy: 0 };
    },
    move: (event, x, y) => {
      if (stick?.id !== event.pointerId) return;
      stick.dx = x - stick.x;
      stick.dy = y - stick.y;
    },
    up: (event) => {
      prompts.lock.lift(event.pointerId);
      if (stick?.id === event.pointerId) stick = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    view = viewSize(w, h, dpr);
    world.view = { w: view.w, h: view.h };
    top = Math.ceil((probe.offsetHeight * dpr) / view.scale);
    canvas.width = view.w * view.scale;
    canvas.height = view.h * view.scale;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    ctx = canvas.getContext('2d');
  }

  function direction() {
    const [w, h] = input.px(1, 1);
    const finger = stick ? stickVector(stick.dx * w, stick.dy * h, 0.12 * w) : { x: 0, y: 0 };
    return pick(finger, keyVector(keys), padVector(navigator.getGamepads?.()[0]?.axes));
  }

  function frame(dt: number) {
    if (!prompts.busy && !menu && !hidden) {
      now += dt;
      step(world, direction(), dt);
      fx.take(world);
      prompts.take();
      fx.update(dt);
    }
    prompts.next(stick?.id ?? null);
    if (later.due(world, prompts.busy)) pause();
    if (world.over && !ended) {
      ended = true;
      onover(world);
      endTimer = setTimeout(onend, world.over === 'clear' ? 2000 : 1200);
    }
    if (ctx) draw(ctx, world, fx, view, now, top);
  }

  function pause() {
    if (!canPause(world, prompts.busy)) return;
    menuFinger = stick?.id ?? null;
    menu = true;
    stick = null;
    keys.clear();
  }

  /** やめるとやり直すは倒れたときと同じに記録する（コインを失わないため） */
  function leave(again: boolean) {
    if (ended) return;
    ended = true;
    world.over = 'dead';
    onover(world);
    if (again) onrestart();
    else onend();
  }

  function keydown(event: KeyboardEvent) {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      if (menu) menu = false;
      else pause();
      return;
    }
    if (!MOVE_KEYS.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  }

  onMount(() => {
    const stop = animate(frame);
    return () => {
      stop();
      prompts.stop();
      clearTimeout(endTimer);
    };
  });
</script>

<svelte:window onkeydown={keydown} onkeyup={(event) => keys.delete(event.code)} onblur={() => keys.clear()} />
<svelte:document
  onvisibilitychange={() => {
    hidden = document.hidden;
    if (hidden && later.hide(world, prompts.busy)) pause();
  }}
/>

<div class="board" use:input.board={resize} role="application" aria-label="森のフィールド">
  <canvas bind:this={canvas}></canvas>
  <span class="probe" bind:this={probe}></span>
  {#if stick}
    {@const [w, h] = input.px(1, 1)}
    <Stick {...stick} {w} {h} />
  {/if}
</div>
<!-- 盤面の中に置くと pointerdown が盤面へ伝わって指をつかまれ、click がカードに届かない -->
{#if !menu && !prompts.busy && !ended}
  <button class="as-pause" onclick={pause} aria-label="一時停止">Ⅱ</button>
{/if}
{#if menu}
  <Pause
    run={summary(world)}
    finger={menuFinger}
    onresume={() => (menu = false)}
    onrestart={() => leave(true)}
    onquit={() => leave(false)}
  />
{/if}
<PromptLayer {prompts} finger={stick?.id ?? null} />

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    background: #56a03c;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    image-rendering: pixelated;
  }

  .probe {
    position: absolute;
    visibility: hidden;
    height: max(72px, calc(env(safe-area-inset-top) + 60px));
  }
</style>
