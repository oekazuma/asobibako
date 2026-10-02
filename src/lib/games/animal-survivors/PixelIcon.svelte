<script lang="ts">
  import type { Action } from 'svelte/action';
  import { bake, type Art } from './pixels';

  let { art, frame = 0, size }: { art: Art; frame?: number; size: string } = $props();

  const paint: Action<HTMLCanvasElement, { art: Art; frame: number }> = (c, first) => {
    const draw = (p: { art: Art; frame: number }) => {
      const g = c.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(bake(p.art, p.frame), 0, 0);
    };
    draw(first);
    return { update: draw };
  };
</script>

<canvas width={art.w} height={art.h} style:width={size} aria-hidden="true" use:paint={{ art, frame }}></canvas>

<style>
  canvas {
    height: auto;
    image-rendering: pixelated;
    flex: none;
  }
</style>
