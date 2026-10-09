<script lang="ts">
  import { onMount } from 'svelte';
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import HideTimer from './HideTimer.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import { Play } from './play.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import { mount3d, pad } from './stage3d';
  import './stage3d.css';
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
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    {...pad(
      () => play,
      () => box
    )}
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
