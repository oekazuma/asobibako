<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<span class="howto-rule">指を左右に動かすと、仲間はその前を撃ちつづける。門の数字は撃つと 1 ずつふえる</span>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark bad">-10</span>撃って青にかえる</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="bolt" /></span>たるを壊してパワーアップ</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="castle" /></span>さいごにボスをたおす</span>
</span>

<style>
  .howto-mark {
    font-size: 0.7em;
    font-weight: 800;
    color: #fff;
  }

  .howto-mark.bad {
    background: var(--p2);
  }
</style>
