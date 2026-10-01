<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<span class="howto-rule">指で左右に動かそう。仲間はまっすぐ前へ撃ちつづけ、門の数字は撃つと 1 ずつふえる</span>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark bad">-2</span>撃って青にかえる</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="bolt" /></span>たるを壊してパワーアップ</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="skull" /></span>敵をぜんぶたおす</span>
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
