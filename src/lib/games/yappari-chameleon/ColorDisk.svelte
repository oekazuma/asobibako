<script lang="ts">
  import { onMount } from 'svelte';

  let { hue, sat, onpick }: { hue: number; sat: number; onpick: (h: number, s: number) => void } = $props();

  const SIZE = 140;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const g = canvas.getContext('2d');
    // テストの DOM（happy-dom）には createConicGradient が無い
    if (!g || !('createConicGradient' in g)) return;
    canvas.width = canvas.height = SIZE * 2;
    const ring = g.createConicGradient(-Math.PI / 2, SIZE, SIZE);
    for (let i = 0; i <= 12; i++) ring.addColorStop(i / 12, `hsl(${i * 30} 100% 50%)`);
    g.fillStyle = ring;
    g.beginPath();
    g.arc(SIZE, SIZE, SIZE, 0, Math.PI * 2);
    g.fill();
    const white = g.createRadialGradient(SIZE, SIZE, 0, SIZE, SIZE, SIZE);
    white.addColorStop(0, '#fff');
    white.addColorStop(1, 'rgb(255 255 255 / 0)');
    g.fillStyle = white;
    g.fill();
  });

  function pick(e: PointerEvent) {
    if (e.type === 'pointerdown') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    else if (!e.buttons) return;
    const r = canvas.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2;
    const dy = e.clientY - r.top - r.height / 2;
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    onpick(h, Math.min(1, Math.hypot(dx, dy) / (r.width / 2)));
  }

  const dot = $derived({
    x: 50 + Math.sin((hue * Math.PI) / 180) * sat * 50,
    y: 50 - Math.cos((hue * Math.PI) / 180) * sat * 50
  });
</script>

<div class="disk" data-part="disk">
  <canvas bind:this={canvas} onpointerdown={pick} onpointermove={pick} aria-label="色相と彩度"></canvas>
  <span class="dot" style:left="{dot.x}%" style:top="{dot.y}%"></span>
</div>

<style>
  .disk {
    position: relative;
    width: 140px;
    height: 140px;
  }

  canvas {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    touch-action: none;
  }

  .dot {
    position: absolute;
    width: 12px;
    height: 12px;
    translate: -50% -50%;
    border: 2px solid #222;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #fff;
    pointer-events: none;
  }
</style>
