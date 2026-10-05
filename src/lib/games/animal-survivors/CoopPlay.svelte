<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { CoopGuest, CoopHost, Pauser } from './coop';
  import { draw, fitCanvas, type ViewSize } from './draw';
  import { Effects } from './effects';
  import { anyChest, anyPending } from './heroes';
  import { steer } from './input';
  import PromptLayer from './PromptLayer.svelte';
  import { Prompts } from './prompts.svelte';
  import Pause from './Pause.svelte';
  import Stick from './Stick.svelte';
  import { step, summary, type World } from './world';

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
  // 子の 3 択・宝箱・演出は、親から届いたものを出して選んだものを親へ送る Prompts（guest が持つ）
  const prompts = host ? new Prompts(world) : (guest?.prompts ?? null);
  let stick = $state<{ id: number; x: number; y: number; dx: number; dy: number } | null>(null);
  let waiting = $state(false);
  /** どちらかが止めている。止めた人の端末には一時停止のメニュー、相手には帯を出す */
  let paused = $state<Pauser>(null);
  // 親か子かは遊んでいるあいだ変わらない
  // svelte-ignore state_referenced_locally
  const me = host ? 'host' : 'guest';
  // svelte-ignore state_referenced_locally
  const side = host ?? guest;
  let over = $state(false);
  /** 倒れた指を離したところに「もどる」が出ると合成 click で押されるので、指が離れるまで押せなくする */
  const settle = new Settle();
  /** ✕ は 1 回めで確かめ、もう一度押すとやめる（親の iPad が眠っても子が抜けられるように、いつでも出す） */
  let sure = $state(false);
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
      if (!prompts.busy && !world.over && !host.paused) {
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
      if (!prompts?.busy && !guest.paused) guest.move(move, dt);
      guest.frame(performance.now());
      fx.take(world);
      prompts?.take();
      prompts?.next(stick?.id ?? null, dt);
      fx.update(dt);
    }
    paused = side?.paused ?? null;
    waiting = !prompts?.busy && !paused && (anyPending(world) || anyChest(world));
    if (world.over && !over) {
      over = true;
      settle.begin();
    }
    if (ctx) draw(ctx, world, fx, view, now, top, prompts ?? undefined);
  }

  onMount(() => {
    const stop = animate(frame);
    const unlisten = settle.listen();
    return () => {
      stop();
      unlisten();
      prompts?.stop();
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
{#if !over}
  <button class="round quit" data-quit onclick={() => (sure ? onend() : (sure = true))} aria-label="やめる"
    >{sure ? 'やめる？' : '✕'}</button
  >
{/if}
{#if !over && !paused && !prompts?.busy}
  <button class="as-pause" onclick={() => side?.pause()} aria-label="一時停止">Ⅱ</button>
{/if}
{#if paused === me}
  <Pause
    run={summary(world)}
    finger={null}
    restart={false}
    onresume={() => side?.resume()}
    onrestart={() => {}}
    onquit={onend}
  />
{:else if paused}
  <p class="note">なかまが とめています</p>
{/if}
{#if waiting}<p class="note">なかまが えらんでいます…</p>{/if}
{#if prompts}<PromptLayer {prompts} finger={stick?.id ?? null} onanswer={() => {}} />{/if}
{#if over}
  <div class="as-screen">
    <section class="as-panel" class:as-locked={settle.active} aria-label="おわり">
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

  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(12px, env(safe-area-inset-right));
    z-index: 6;
    width: auto;
    min-width: 44px;
    padding: 0 10px;
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
