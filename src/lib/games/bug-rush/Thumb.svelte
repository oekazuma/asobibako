<!-- 真ん中の巣から虫があふれ、上下の陣地に散らばる -->
<div class="thumb" aria-hidden="true">
  <span class="zone p2"></span>
  <span class="zone p1"></span>
  {#each [[18, 22, 20], [40, 32, -30], [66, 18, 60], [82, 38, 10], [28, 72, 160], [55, 82, 200], [76, 66, 120]] as [x, y, r], i (i)}
    <span class="bug" style:left="{x}%" style:top="{y}%" style:rotate="{r}deg"></span>
  {/each}
  <span class="beetle" style:left="48%" style:top="56%"></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .zone {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
  }

  .zone.p2 {
    top: 0;
    background: var(--p2-soft);
  }

  .zone.p1 {
    bottom: 0;
    background: var(--p1-soft);
    box-shadow: 0 -4px 0 #fff;
  }

  .bug,
  .beetle {
    position: absolute;
    aspect-ratio: 0.8;
    border: 2px solid #fff;
    border-radius: 50% 50% 46% 46%;
    translate: -50% -50%;
    box-shadow: 0 2px 0 rgb(43 45 66 / 0.2);
  }

  .bug {
    width: 18px;
    background: #3b9d4a;
  }

  .beetle {
    width: 30px;
    background: #8a4b2a;
  }
</style>
