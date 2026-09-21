<script lang="ts">
  import { COLORS } from './engine';
  import { GLYPH, HEX } from './palette';
</script>

<!-- まん中の帯に、色と形の違う玉が並ぶ -->
<div class="thumb" aria-hidden="true">
  <span class="zone p2"></span>
  <span class="zone p1"></span>
  <span class="band"></span>
  <span class="chips">
    {#each COLORS as color (color)}
      <span class="chip" style:--c={HEX[color]}>{GLYPH[color]}</span>
    {/each}
  </span>
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
  }

  .band {
    position: absolute;
    left: 0;
    right: 0;
    top: 30%;
    height: 40%;
    background: rgb(255 255 255 / 0.75);
  }

  .chips {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6%;
  }

  .chip {
    display: grid;
    place-items: center;
    width: 16%;
    max-width: 36px;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.18);
    color: rgb(0 0 0 / 0.45);
    font-size: 14px;
  }
</style>
