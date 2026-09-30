<script lang="ts">
  let { rush }: { rush: boolean } = $props();
</script>

<!-- 境界の位置（--b）と決着の線の位置（--win）は盤面から受け継ぐ -->
<div class="zone p2"></div>
<div class="zone p1" class:rush></div>
<!-- ここまで押し込めば勝ち -->
<div class="finish p2"></div>
<div class="finish p1"></div>

<style>
  .zone {
    position: absolute;
    inset: 0;
    transition: transform 160ms ease-out;
  }

  .zone.p2 {
    background: var(--dots), var(--zone-2);
    transform: translateY(calc((var(--b) - 1) * 100%));
  }

  .zone.p1 {
    background: var(--dots), var(--zone-1);
    transform: translateY(calc(var(--b) * 100%));
    /* 境界線は太い白線に薄い影を添えて、明るい陣地の上でもはっきり見せる */
    box-shadow:
      inset 0 6px 0 #fff,
      inset 0 10px 0 rgb(43 45 66 / 0.08);
  }

  /* ラッシュのあいだは境界線を金色にして、押す力が強いことを見せる */
  .zone.p1.rush {
    box-shadow:
      inset 0 6px 0 var(--gold),
      inset 0 12px 0 rgb(255 194 51 / 0.35);
  }

  .finish {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 4px dashed rgb(43 45 66 / 0.25);
    pointer-events: none;
  }

  .finish.p2 {
    top: var(--win);
  }

  .finish.p1 {
    bottom: var(--win);
  }

  @media (prefers-reduced-motion: reduce) {
    .zone {
      transition: none;
    }
  }
</style>
