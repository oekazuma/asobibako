<script lang="ts">
  import Glyph from './Glyph.svelte';
</script>

<!-- 上下に色だけ・形だけのヒント、真ん中に合図 -->
<div class="thumb" aria-hidden="true">
  <span class="half top"><Glyph shape="star" size="30px" /></span>
  <span class="signal"><Glyph color="orange" shape="star" /></span>
  <span class="half"><Glyph color="orange" size="30px" /></span>
</div>

<style>
  .thumb {
    position: relative;
    display: grid;
    grid-template-rows: 1fr 1fr;
    place-items: center;
    height: 100%;
    background: linear-gradient(to bottom, var(--p2-soft) 50%, var(--p1-soft) 50%);
  }

  .top {
    rotate: 180deg;
  }

  .signal {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 56px;
    aspect-ratio: 1;
    padding: 12px;
    border: 4px solid #fff;
    border-radius: 50%;
    background: var(--card);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
    translate: -50% -50%;
  }
</style>
