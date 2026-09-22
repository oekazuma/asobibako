<script lang="ts">
  import { RUSH_S } from './engine';
</script>

<span class="howto-rule">自分の玉を消して境界線を押し込む<br />{RUSH_S} 秒をすぎると押す力が強まる</span>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark tap"></span>タップ</span>
  <span class="howto-item"><span class="howto-mark hold"></span>長押し</span>
  <span class="howto-item"><span class="howto-mark contest"></span>早い者勝ち</span>
</span>

<style>
  .howto-mark.tap {
    background: currentColor;
  }

  .howto-mark.hold {
    border: 3px solid currentColor;
  }

  .howto-mark.contest {
    background: var(--gold);
  }
</style>
