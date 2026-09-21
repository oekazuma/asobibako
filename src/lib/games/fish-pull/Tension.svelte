<script lang="ts">
  import type { Player } from '$lib/player';

  let { player, value, snapped }: { player: Player; value: number; snapped: boolean } = $props();
</script>

<!-- 糸の張り。緑から赤へ変わり、いっぱいになると切れる。各プレイヤーの手元の辺に置く -->
<div class="tension p{player}" style:--t={value}>
  {#if snapped}
    <span class="snap sticker">ぷつん！</span>
  {:else}
    <span class="bar"><span class="fill"></span></span>
  {/if}
</div>

<style>
  .tension {
    position: absolute;
    left: 50%;
    display: grid;
    place-items: center;
    width: min(60%, 420px);
    height: 44px;
    translate: -50% 0;
    pointer-events: none;
  }

  .tension.p1 {
    bottom: max(14px, env(safe-area-inset-bottom));
  }

  .tension.p2 {
    top: max(14px, env(safe-area-inset-top));
    rotate: 180deg;
  }

  .bar {
    width: 100%;
    height: 18px;
    overflow: hidden;
    border: 3px solid #fff;
    border-radius: 999px;
    background: rgb(43 45 66 / 0.12);
    box-shadow: 0 3px 0 rgb(43 45 66 / 0.15);
  }

  .fill {
    display: block;
    height: 100%;
    transform: scaleX(min(1, var(--t)));
    transform-origin: left;
    /* 120（緑）から 0（赤）へ */
    background: hsl(calc((1 - var(--t)) * 120) 80% 50%);
  }

  .snap {
    color: var(--p2);
    font-size: 28px;
    animation: shake 300ms ease-out;
  }

  @keyframes shake {
    25% {
      translate: -6px 0;
    }
    75% {
      translate: 6px 0;
    }
  }
</style>
