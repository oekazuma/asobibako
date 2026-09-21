<script lang="ts">
  import type { Player } from '$lib/player';

  let { side, x, y }: { side: Player; x: number; y: number } = $props();
</script>

<!-- 吹き飛ばされた側の陣地を光らせ、爆発した位置から火球を広げる -->
<div class="flash p{side}"></div>
<div class="burst" style:left="{x * 100}%" style:top="{y * 100}%"></div>

<style>
  .flash {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    background: #ff5a36;
    animation: flash 650ms ease-out forwards;
    pointer-events: none;
  }

  .flash.p2 {
    top: 0;
  }

  .flash.p1 {
    bottom: 0;
  }

  .burst {
    position: absolute;
    width: 30%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, #fff6c2, #ffb020 35%, #ff4b2b 60%, transparent 70%);
    translate: -50% -50%;
    animation: burst 600ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes flash {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes burst {
    from {
      transform: scale(0.2);
      opacity: 1;
    }
    to {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .burst {
      animation: none;
      opacity: 0;
    }
  }
</style>
