<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import type { CoopGuest, CoopHost } from './coop';
  import { draw, fitCanvas, type ViewSize } from './draw';
  import { Effects } from './effects';
  import { anyPending } from './heroes';
  import { steer } from './input';
  import PromptLayer from './PromptLayer.svelte';
  import { Prompts } from './prompts.svelte';
  import Stick from './Stick.svelte';
  import { step, type World } from './world';

  /** 親は host と自分の World、子は guest と描くための World（guest.view）を受け取る */
  let {
    host,
    guest,
    world: given,
    onend
  }: { host?: CoopHost | null; guest?: CoopGuest | null; world: World; onend: () => void } = $props();
  // 親の World も子の描くための World も、遊んでいるあいだ同じものを毎フレーム進めて書き換える（作り直さない）
  // svelte-ignore state_referenced_locally
  const world = given;

  let canvas: HTMLCanvasElement;
  let probe: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let view: ViewSize = { scale: 2, w: 260, h: 380 };
  let top = 24;
  const fx = new Effects();
  const keys = new Set<string>();
  // svelte-ignore state_referenced_locally
  const prompts = host ? new Prompts(world) : null;
  let stick = $state<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  let waiting = $state(false);
  let over = $state(false);
  let ended = false;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let now = 0;

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!stick && !prompts?.busy) stick = { id: event.pointerId, x, y, dx: 0, dy: 0 };
    },
    move: (event, x, y) => {
      if (stick?.id !== event.pointerId) return;
      stick.dx = x - stick.x;
      stick.dy = y - stick.y;
    },
    up: (event) => {
      prompts?.lock.lift(event.pointerId);
      if (stick?.id === event.pointerId) stick = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    view = fitCanvas(canvas, w, h);
    world.view = { w: view.w, h: view.h };
    top = Math.ceil((probe.offsetHeight * (devicePixelRatio || 1)) / view.scale);
    ctx = canvas.getContext('2d');
  }

  function frame(dt: number) {
    now += dt;
    const move = steer(stick, input.px(1, 1), keys);
    if (host && prompts) {
      host.before();
      if (!prompts.busy && !world.over) {
        step(world, move, dt);
        fx.update(dt);
      }
      // 子へ送る出来事は、手元の効果が拾って消す前に渡す
      host.after(dt);
      fx.take(world);
      prompts.take();
      world.events.length = 0;
      prompts.next(stick?.id ?? null, dt);
    } else if (guest) {
      guest.move(move, dt);
      guest.frame(performance.now());
      fx.take(world);
      fx.update(dt);
    }
    waiting = !prompts?.busy && anyPending(world);
    if (world.over && !ended) {
      ended = true;
      // 倒れた指を離したところに「もどる」が出ると、合成 click で押されてしまう
      endTimer = setTimeout(() => (over = true), 1200);
    }
    if (ctx) draw(ctx, world, fx, view, now, top, prompts ?? undefined);
  }

  onMount(() => {
    const stop = animate(frame);
    return () => {
      stop();
      prompts?.stop();
      clearTimeout(endTimer);
    };
  });
</script>

<div class="board" use:input.board={resize} role="application" aria-label="ふたりで遊ぶ森">
  <canvas bind:this={canvas}></canvas>
  <span class="as-probe" bind:this={probe}></span>
  {#if stick}
    {@const [w, h] = input.px(1, 1)}
    <Stick {...stick} {w} {h} />
  {/if}
</div>
{#if waiting}<p class="note">なかまが えらんでいます…</p>{/if}
{#if prompts}<PromptLayer {prompts} finger={stick?.id ?? null} onanswer={() => {}} />{/if}
{#if over}
  <div class="as-screen">
    <section class="as-panel" aria-label="おわり">
      <h2 class="as-title">おわり</h2>
      <button class="as-card as-go" onclick={onend}>もどる</button>
    </section>
  </div>
{/if}

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
    inset: 0 auto auto 0;
    image-rendering: pixelated;
  }

  .note {
    position: absolute;
    top: 30%;
    left: 50%;
    margin: 0;
    padding: 6px 14px;
    translate: -50% 0;
    background: rgb(36 21 31 / 0.8);
    color: #fff3d6;
    font-weight: 800;
    pointer-events: none;
  }
</style>
