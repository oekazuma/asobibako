<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { ROUND_S } from './engine';
</script>

<span class="howto-rule">ネコとネズミを 1 回ずつ。ネズミのときに食べたチーズが多いほうの勝ち</span>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark"><Icon name="cat" size="100%" /></span>つかまえたら交代</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="mouse" size="100%" /></span>{ROUND_S} 秒にげきれ</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="cheese" size="100%" /></span>1 こで 1 点</span>
  <span class="howto-item">指を置いてずらすと走る</span>
</span>
