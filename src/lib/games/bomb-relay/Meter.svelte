<script lang="ts">
  import type { Player } from '$lib/player';

  let { player, value, filling }: { player: Player; value: number; filling: boolean } = $props();
</script>

<!-- 各プレイヤーの手元の辺に置く。向かい側は 180 度回して、どちらも左から満ちていく -->
<div class="meter p{player}" class:filling style:--m={value}>
  <div class="fill"></div>
</div>

<style>
  .meter {
    position: absolute;
    left: 50%;
    width: min(70%, 520px);
    height: 18px;
    translate: -50% 0;
    overflow: hidden;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.12);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
  }

  .meter.p1 {
    bottom: max(14px, env(safe-area-inset-bottom));
  }

  .meter.p2 {
    top: max(14px, env(safe-area-inset-top));
    rotate: 180deg;
  }

  .fill {
    height: 100%;
    transform: scaleX(var(--m));
    transform-origin: left;
  }

  .p1 .fill {
    background: var(--p1);
  }

  .p2 .fill {
    background: var(--p2);
  }

  /* 持っているあいだは、手元のメーターが光る */
  .filling {
    box-shadow:
      0 0 0 4px var(--gold),
      0 3px 0 rgb(43 45 66 / 0.15);
  }
</style>
