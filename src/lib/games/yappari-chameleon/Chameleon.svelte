<script lang="ts">
  import { onMount } from 'svelte';
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import HideTimer from './HideTimer.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import { Play } from './play.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import { mount3d, touch } from './stage3d';
  import StickView from './StickView.svelte';

  let { onquit }: { onquit?: () => void } = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let failed = $state(false);
  let play = $state.raw<Play | null>(null);
  const radius = 70;

  onMount(() =>
    mount3d(canvas, box, {
      ready: (world) => {
        play = new Play(world, radius);
        if (import.meta.env.DEV) (window as unknown as { __chameleon?: Play }).__chameleon = play;
      },
      frame: (dt, now) => play?.frame(dt, now),
      interrupt: () => play?.interrupt(),
      restore: () => play?.rebuildPaint(),
      fail: () => (failed = true),
      portrait: (on) => (portrait = on)
    })
  );

  function pointer(kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) {
    if (play) touch(play, box, kind, e);
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
    {#if play.mode !== 'eye'}<HideTimer {play} />{/if}
    <Buttons {play} onquit={() => onquit?.()} />
  {:else if failed}
    <div class="notice failed">
      <p>この端末では 3D を表示できません</p>
      <button onclick={() => onquit?.()}>タイトルへ</button>
    </div>
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
    container-type: size;
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

  .failed {
    align-content: center;
    gap: 16px;
    pointer-events: auto;
  }

  .failed p {
    margin: 0;
  }

  .failed button {
    padding: 8px 24px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 24px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    font-size: 18px;
  }

  .cover {
    background: #1d1a17;
    pointer-events: auto;
  }
</style>
