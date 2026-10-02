<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { AnimalId } from './animals';
  import { apply, choices, type Choice } from './choices';
  import { draw, viewSize, type ViewSize } from './draw';
  import { Effects } from './effects';
  import { keyVector, padVector, pick, stickVector } from './input';
  import LevelUp from './LevelUp.svelte';
  import { createWorld, step, type World } from './world';

  let { animal, onend }: { animal: AnimalId; onend: (w: World) => void } = $props();

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  let canvas: HTMLCanvasElement;
  let probe: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let low: HTMLCanvasElement | null = null;
  let lowCtx: CanvasRenderingContext2D | null = null;
  let view: ViewSize = { scale: 2, w: 260, h: 380 };
  /** HUD を書きはじめる高さ（仮想ドット）。シェルの隅のボタンの下 */
  let top = 24;
  // svelte-ignore state_referenced_locally
  const world = createWorld(animal, Date.now() % 2 ** 31, { w: view.w, h: view.h });
  const fx = new Effects();
  const keys = new SvelteSet<string>();
  // 3 択が指の下に出るので、指を離したときの合成 click でカードが押されないよう、出た直後は当たり判定を消す
  const settle = new Settle();
  let options = $state<Choice[] | null>(null);
  let stick = $state<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  let paused = false;
  let now = 0;
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!stick && !options) stick = { id: event.pointerId, x, y, dx: 0, dy: 0 };
    },
    move: (event, x, y) => {
      if (stick?.id !== event.pointerId) return;
      stick.dx = x - stick.x;
      stick.dy = y - stick.y;
    },
    up: (event) => {
      if (stick?.id === event.pointerId) stick = null;
    }
  });

  /** つまみは、外の丸の半径（盤面の幅の 12%）までずらして見せる */
  const knob = $derived.by(() => {
    if (!stick) return '0 0';
    const [w, h] = input.px(1, 1);
    const x = stick.dx * w;
    const y = stick.dy * h;
    const k = Math.min(1, (0.12 * w) / (Math.hypot(x, y) || 1));
    return `${x * k}px ${y * k}px`;
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
    low ??= document.createElement('canvas');
    low.width = view.w;
    low.height = view.h;
    lowCtx = low.getContext('2d');
  }

  function direction() {
    const [w, h] = input.px(1, 1);
    const finger = stick ? stickVector(stick.dx * w, stick.dy * h, 0.12 * w) : { x: 0, y: 0 };
    return pick(finger, keyVector(keys), padVector(navigator.getGamepads?.()[0]?.axes));
  }

  function choose(c: Choice) {
    apply(world, c);
    options = world.pending > 0 ? choices(world) : null;
    if (options) settle.begin();
  }

  function frame(dt: number) {
    if (!options && !paused) {
      now += dt;
      step(world, direction(), dt);
      fx.take(world);
      fx.update(dt);
    }
    if (world.pending > 0 && !options && !world.over) {
      options = choices(world);
      settle.begin();
    }
    if (world.over && !endTimer) endTimer = setTimeout(() => onend(world), world.over === 'clear' ? 2000 : 1200);
    if (!ctx || !lowCtx || !low) return;
    draw(lowCtx, world, fx, view, now, top);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, canvas.width, canvas.height);
  }

  function keydown(event: KeyboardEvent) {
    if (!MOVE_KEYS.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  }

  onMount(() => {
    const stopSettle = settle.listen();
    const stop = animate(frame);
    return () => {
      stop();
      stopSettle();
      clearTimeout(endTimer);
    };
  });
</script>

<svelte:window onkeydown={keydown} onkeyup={(event) => keys.delete(event.code)} onblur={() => keys.clear()} />
<svelte:document onvisibilitychange={() => (paused = document.hidden)} />

<div class="board" use:input.board={resize} role="application" aria-label="森のフィールド">
  <canvas bind:this={canvas}></canvas>
  <span class="probe" bind:this={probe}></span>
  {#if stick}
    <span class="stick" style:left="{stick.x * 100}%" style:top="{stick.y * 100}%">
      <span class="knob" style:translate={knob}></span>
    </span>
  {/if}
  {#if options}
    <LevelUp {options} locked={settle.active} onpick={choose} />
  {/if}
</div>

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

  .stick {
    position: absolute;
    width: 24cqw;
    aspect-ratio: 1;
    translate: -50% -50%;
    border: 3px solid rgb(255 255 255 / 0.5);
    border-radius: 50%;
    background: rgb(36 21 31 / 0.15);
    pointer-events: none;
  }

  .knob {
    position: absolute;
    inset: 30%;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.6);
  }
</style>
