<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { Settle } from '$lib/settle.svelte';
  import type { CoopGuest, CoopHost, Outcome, Pauser } from './coop';
  import CoopOverlay from './CoopOverlay.svelte';
  import { draw, fitCanvas, type ViewSize } from './draw';
  import { Effects } from './effects';
  import { anyChest, anyPending } from './heroes';
  import { steer } from './input';
  import PromptLayer from './PromptLayer.svelte';
  import { Prompts } from './prompts.svelte';
  import Stick from './Stick.svelte';
  import { startOvertime } from './overtime';
  import { step, type World } from './world';

  /** 親は host と自分の World、子は guest と描くための World（guest.view）を受け取る */
  let {
    host,
    guest,
    world: given,
    onend,
    onagain
  }: {
    host?: CoopHost | null;
    guest?: CoopGuest | null;
    world: World;
    onend: () => void;
    /** 親だけ。同じ動物・ステージ・釜で 2 人とも始め直す */
    onagain?: () => void;
  } = $props();
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
  let waiting = $state('');
  let result = $state.raw<Outcome | null>(null);
  let ended = false;
  let askTimer: ReturnType<typeof setTimeout> | undefined;
  /** どちらかが止めている。止めた人の端末には一時停止のメニュー、相手には帯を出す */
  let paused = $state<Pauser>(null);
  const me = $derived(host ? 'host' : 'guest');
  const side = $derived(host ?? guest);
  /** 倒れた指を離したところに「もどる」が出ると合成 click で押されるので、指が離れるまで押せなくする */
  const settle = new Settle();
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

  /** 親はその回を倒れたときと同じに終えて 2 人ともリザルトを出し、子は自分のぶんを記録して抜ける */
  function quit() {
    if (host && !world.over) world.over = 'dead';
    guest?.quit();
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
    if (host && world.over && !ended) {
      ended = true;
      // 10:00 のクリアでは記録してから延長戦を聞く（記録は延長戦の終わりにもう 1 回、差だけを入れる）
      const clear = world.over === 'clear' && !world.overtime;
      host.finish(!clear);
      if (clear) askTimer = setTimeout(() => prompts?.ask(stick?.id ?? null), 1200);
    }
    // 親とつながらないまま、記録するまとめも無く抜けた子はそのまま戻る
    if (guest?.done && !guest.result) return onend();
    if (side?.result && side.result !== result) {
      result = side.result;
      settle.begin();
    }
    waiting =
      result || prompts?.busy || paused
        ? ''
        : world.over === 'clear' && guest
          ? 'おやが えらんでいます…'
          : anyPending(world) || anyChest(world)
            ? 'なかまが えらんでいます…'
            : '';
    if (ctx) draw(ctx, world, fx, view, now, top, prompts ?? undefined);
  }

  onMount(() => {
    const stop = animate(frame);
    const unlisten = settle.listen();
    return () => {
      stop();
      unlisten();
      prompts?.stop();
      clearTimeout(askTimer);
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
<CoopOverlay
  {me}
  {side}
  {world}
  {paused}
  {waiting}
  {result}
  locked={settle.active}
  busy={!!prompts?.busy}
  {onend}
  onquit={quit}
  {onagain}
/>
{#if prompts}
  <PromptLayer
    {prompts}
    finger={stick?.id ?? null}
    onanswer={(go) => {
      if (!go) return host?.end();
      startOvertime(world);
      ended = false;
    }}
  />
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
</style>
