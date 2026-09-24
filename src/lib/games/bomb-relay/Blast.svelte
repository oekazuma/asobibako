<script lang="ts">
  import type { Player } from '$lib/player';

  /** lost は吹き飛んだメーターの量（0..1） */
  let { side, x, y, lost }: { side: Player; x: number; y: number; lost: number } = $props();

  const percent = $derived(Math.round(lost * 100));
</script>

<!-- 吹き飛ばされた側の陣地を光らせ、爆発した位置から火球を広げ、減った量をその人に向けて出す -->
<div class="flash p{side}"></div>
<div class="burst" style:left="{x * 100}%" style:top="{y * 100}%"></div>
<div class="loss p{side}">
  <span class="sticker">{percent > 0 ? `-${percent}%` : 'セーフ'}</span>
</div>

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

  .loss {
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .loss.p1 {
    bottom: 0;
  }

  .loss.p2 {
    top: 0;
    rotate: 180deg;
  }

  .loss .sticker {
    color: var(--p2-deep);
    font-size: min(12cqh, 22cqw);
    animation: loss 1100ms var(--spring) forwards;
  }

  @keyframes loss {
    0% {
      scale: 0.3;
      opacity: 0;
    }
    20% {
      scale: 1;
      opacity: 1;
    }
    75% {
      opacity: 1;
      translate: 0 0;
    }
    100% {
      opacity: 0;
      translate: 0 20%;
    }
  }

  @keyframes fade {
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
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

    .loss .sticker {
      animation-name: fade;
    }
  }
</style>
