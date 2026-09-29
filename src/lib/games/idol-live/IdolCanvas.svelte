<script lang="ts">
  import { onMount } from 'svelte';
  import { animate } from '$lib/loop';
  import { Idol } from './idol-draw';
  import type { Coord } from './outfits';
  import { blend, groove, joints, POSES } from './pose';

  /** じゅんびの画面で、着せた服のままリズムに乗って待つアイドル。着がえるたびにポーズをきめる */
  let { coord }: { coord: Coord } = $props();

  let canvas: HTMLCanvasElement;
  const idol = new Idol();
  let show = 0;
  let last = '';

  onMount(() => {
    const ctx = canvas.getContext('2d');
    let t = 0;
    return animate((dt) => {
      t += dt;
      const key = Object.values(coord).join();
      if (key !== last) [last, show] = [key, last ? 1.2 : 0];
      show = Math.max(0, show - dt);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      if (!ctx || !w || !h) return;
      const beat = t * 2; // 120 BPM でリズムに乗る
      const u = Math.min(1, show * 3, (1.2 - show) * 5);
      const body = joints(groove(blend(POSES.idle, POSES.appealR, show > 0 ? u : 0), beat, 0.5));
      idol.update(body, dt);
      const k = Math.min(h / 1.12, w / 0.75);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h * 0.97);
      ctx.scale(k, k);
      idol.draw(ctx, body, coord, { mouth: 0, face: show > 0 ? 'wink' : undefined });
    });
  });
</script>

<canvas bind:this={canvas} aria-label="ミオ"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
