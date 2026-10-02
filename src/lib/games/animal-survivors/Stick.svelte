<script lang="ts">
  /** x, y, dx, dy は盤面に対する 0..1、w, h は盤面の大きさ（px） */
  let { x, y, dx, dy, w, h }: { x: number; y: number; dx: number; dy: number; w: number; h: number } = $props();

  /** つまみは、外の丸の半径（盤面の幅の 12%）までずらして見せる */
  const knob = $derived.by(() => {
    const px = dx * w;
    const py = dy * h;
    const k = Math.min(1, (0.12 * w) / (Math.hypot(px, py) || 1));
    return `${px * k}px ${py * k}px`;
  });
</script>

<span class="stick" style:left="{x * 100}%" style:top="{y * 100}%">
  <span class="knob" style:translate={knob}></span>
</span>

<style>
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
