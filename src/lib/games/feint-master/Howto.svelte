<script lang="ts">
  import Glyph from './Glyph.svelte';
</script>

<span class="howto-rule">色も形も合った合図で押す。自分はその半分しか知らない</span>
<span class="howto-legend">
  <span class="howto-item"><Glyph color="purple" shape="star" size="20px" />合ったら押す</span>
  <span class="howto-item"><span class="howto-mark bad">✕</span>ちがう合図はおてつき</span>
  <span class="howto-item"><span class="howto-mark">👀</span>相手の手を読む・釣る</span>
</span>

<style>
  .howto-mark.bad {
    background: var(--p2);
    color: #fff;
    font-weight: 800;
  }
</style>
