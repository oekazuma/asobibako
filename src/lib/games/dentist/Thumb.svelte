<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<!-- クマの患者さんと、ピンセットでつままれたバイキン -->
<div class="thumb" aria-hidden="true">
  <span class="bear"><Icon name="bear" /></span>
  <span class="tooth"><Icon name="tooth" /></span>
  <span class="germ"><Icon name="germ" /></span>
  <span class="tweezers"><Icon name="tweezers" /></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background:
      linear-gradient(rgb(74 46 31 / 0.05) 2px, transparent 2px) 0 0 / 22px 22px,
      linear-gradient(90deg, rgb(74 46 31 / 0.05) 2px, transparent 2px) 0 0 / 22px 22px,
      #fff8ea;
  }

  span {
    position: absolute;
  }

  .bear {
    top: 14%;
    left: 50%;
    font-size: 64px;
    translate: -50% 0;
  }

  .tooth {
    bottom: 10%;
    left: 22%;
    font-size: 30px;
    rotate: -12deg;
  }

  .germ {
    top: 18%;
    right: 14%;
    font-size: 26px;
  }

  .tweezers {
    top: 4%;
    right: 8%;
    font-size: 30px;
    rotate: 20deg;
  }
</style>
