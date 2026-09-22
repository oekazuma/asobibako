<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<!-- ピンの上に金貨、下で待つ子ども -->
<div class="thumb" aria-hidden="true">
  <span class="wall l"></span>
  <span class="wall r"></span>
  <span class="gold"></span>
  <span class="pin"><span class="knob"></span></span>
  <span class="kid"><Icon name="kid" /></span>
</div>

<style>
  .thumb {
    position: relative;
    height: 100%;
    background: linear-gradient(to bottom, #d8f1ff, #fff3dc);
  }

  .wall {
    position: absolute;
    top: 10%;
    width: 6px;
    height: 44%;
    border-radius: 3px;
    background: #7b5a45;
  }

  .l {
    left: 36%;
  }

  .r {
    left: 62%;
  }

  .gold {
    position: absolute;
    top: 26%;
    left: calc(36% + 6px);
    width: calc(26% - 6px);
    height: 28%;
    background: radial-gradient(circle, #ffc233 5px, #e39a00 6px) 0 0 / 11px 11px;
  }

  .pin {
    position: absolute;
    top: 54%;
    left: 32%;
    width: 42%;
    height: 7px;
    border-radius: 4px;
    background: #c9ccd8;
  }

  .knob {
    position: absolute;
    right: -8px;
    top: 50%;
    width: 18px;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 50%;
    background: #ffc233;
    translate: 0 -50%;
  }

  .kid {
    position: absolute;
    bottom: 4%;
    left: 50%;
    font-size: 30px;
    translate: -50% 0;
  }
</style>
