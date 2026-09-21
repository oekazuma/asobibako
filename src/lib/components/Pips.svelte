<script lang="ts">
  import type { Player } from '$lib/player';

  /** corner: 辺の中央ではなく、各プレイヤーから見て左の隅に寄せる（辺の中央をゴールなどに使うゲーム向け） */
  let {
    player,
    score,
    goal,
    corner = false
  }: { player: Player; score: number; goal: number; corner?: boolean } = $props();
</script>

<!-- 各プレイヤーの手元の辺に、取った数を丸で並べる。向かい側は 180 度回す -->
<div class="pips p{player}" class:corner>
  {#each Array.from({ length: goal }, (_, i) => i) as i (i)}
    <span class="pip" class:on={i < score}></span>
  {/each}
</div>

<style>
  .pips {
    position: absolute;
    left: 50%;
    display: flex;
    gap: 10px;
    translate: -50% 0;
  }

  .pips.p1 {
    bottom: max(16px, env(safe-area-inset-bottom));
  }

  .pips.p2 {
    top: max(16px, env(safe-area-inset-top));
    rotate: 180deg;
  }

  /* 向かい側は 180 度回しているので、その人から見た左は画面の右になる */
  .corner.p1 {
    left: max(16px, env(safe-area-inset-left));
    translate: none;
  }

  .corner.p2 {
    left: auto;
    right: max(16px, env(safe-area-inset-right));
    translate: none;
  }

  .pip {
    width: 24px;
    height: 24px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: rgb(43 45 66 / 0.12);
    box-shadow: 0 2px 0 rgb(43 45 66 / 0.15);
    transition:
      background-color 160ms,
      scale 260ms var(--spring);
  }

  .p1 .on {
    background: var(--p1);
  }

  .p2 .on {
    background: var(--p2);
  }

  .on {
    scale: 1.2;
  }
</style>
