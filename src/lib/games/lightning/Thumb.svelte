<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<!-- 上下の陣地に向かい合わせの指示カードと、真ん中の稲妻 -->
<div class="thumb" aria-hidden="true">
  <span class="card top"><Icon name="arrow" /></span>
  <span class="bolt"><Icon name="bolt" /></span>
  <span class="card bottom"><Icon name="tap" /></span>
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

  .card {
    display: grid;
    place-items: center;
    width: 64px;
    height: 44px;
    border: 3px solid #fff;
    border-radius: 12px;
    background: var(--card);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
    font-size: 24px;
  }

  .top {
    rotate: 180deg;
  }

  .bolt {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 38px;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--gold);
    font-size: 18px;
    translate: -50% -50%;
  }
</style>
