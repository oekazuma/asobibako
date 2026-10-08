<script lang="ts">
  /** ox・oy は指を置いた所（CSS px）、x・y は −1..1 の倒し具合、r は倒し切る距離（px） */
  let { ox, oy, x, y, r }: { ox: number; oy: number; x: number; y: number; r: number } = $props();
</script>

<span class="ring" style:left="{ox}px" style:top="{oy}px" style:width="{r * 2}px" style:height="{r * 2}px">
  <span class="knob" style:translate="{x * r}px {y * r}px"></span>
</span>

<style>
  .ring {
    position: absolute;
    translate: -50% -50%;
    border: 3px solid rgb(255 255 255 / 0.55);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.18);
    pointer-events: none;
  }

  .knob {
    position: absolute;
    inset: 28%;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.65);
  }
</style>
