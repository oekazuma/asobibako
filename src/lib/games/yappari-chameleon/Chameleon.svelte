<script lang="ts">
  import { onMount } from 'svelte';
  import { wake } from '$lib/audio.svelte';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { layAtlas } from './atlas';
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import { buildDoll } from './doll';
  import { makeDoll } from './doll3d';
  import { COLOR_SIZE } from './paint-gpu';
  import { Play } from './play.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import StickView from './StickView.svelte';
  import { buildMansion } from './mansion/build';
  import { World } from './world3d';

  let { onquit }: SoloProps = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let play = $state.raw<Play | null>(null);
  const radius = 70;

  onMount(() => {
    const mq = matchMedia('(orientation: portrait)');
    let stop: (() => void) | null = null;
    let world: World | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const size = () => world?.resize(box.clientWidth, box.clientHeight);
    const run = () => {
      stop?.();
      stop = null;
      portrait = mq.matches;
      if (portrait) play?.interrupt();
      if (portrait || !play) return;
      size();
      const p = play;
      stop = animate((dt, now) => p.frame(dt, now));
    };
    const build = () => {
      const s = buildDoll();
      const atlas = layAtlas(s.pos, s.idx, COLOR_SIZE);
      world = new World(
        canvas,
        (r) => makeDoll(r, s, atlas),
        () => play?.rebuildPaint()
      );
      world.setStage(buildMansion());
      size();
      play = new Play(world, radius);
      if (import.meta.env.DEV) (window as unknown as { __chameleon?: Play }).__chameleon = play;
      run();
    };
    // 人形の面と升目を作るのに数百 ms 止まるので、「準備中」を 1 度描かせてから作る
    const raf = requestAnimationFrame(() => (timer = setTimeout(build)));
    mq.addEventListener('change', run);
    const ro = new ResizeObserver(size);
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      mq.removeEventListener('change', run);
      ro.disconnect();
      stop?.();
      world?.dispose();
    };
  });

  function pointer(kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) {
    if (!play) return;
    if (kind === 'down') {
      wake();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // 合成イベントでは掴めないが、指の追跡は続けてよい
      }
    }
    const r = box.getBoundingClientRect();
    play.pointer(kind, e.pointerId, e.clientX - r.left, e.clientY - r.top, r.width);
  }
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    onpointerdown={(e) => pointer('down', e)}
    onpointermove={(e) => pointer('move', e)}
    onpointerup={(e) => pointer('up', e)}
    onpointercancel={(e) => pointer('cancel', e)}
  ></div>
  {#if play}
    {#if play.stick.active}
      <StickView ox={play.stick.ox} oy={play.stick.oy} x={play.stick.x} y={play.stick.y} r={radius} />
    {/if}
    {#if play.mode === 'paint'}
      <PaintPanel {play} />
      <BrushSize
        bind:value={play.brush.radius}
        onchange={() => play?.showCursor(box.clientWidth / 2, box.clientHeight / 2)}
      />
    {/if}
    {#if play.wheel}
      <PoseWheel {play} />
    {/if}
    <Buttons {play} onquit={() => onquit?.()} />
  {:else}
    <p class="notice">準備中…</p>
  {/if}
  {#if portrait}
    <p class="notice cover">横向きにしてください</p>
  {/if}
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #1d1a17;
  }

  canvas,
  .pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .notice {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  .cover {
    background: #1d1a17;
    pointer-events: auto;
  }
</style>
