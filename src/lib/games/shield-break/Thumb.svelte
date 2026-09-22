<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<!-- 向かい合う剣と盾、真ん中に拍の輪 -->
<div class="thumb" aria-hidden="true">
  <span class="face top"><Icon name="sword" /></span>
  <span class="ring"></span>
  <span class="face bottom"><Icon name="shield" /></span>
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

  .face {
    font-size: 34px;
  }

  .top {
    rotate: 180deg;
  }

  .ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    aspect-ratio: 1;
    border: 4px solid var(--gold);
    border-radius: 50%;
    translate: -50% -50%;
  }
</style>
