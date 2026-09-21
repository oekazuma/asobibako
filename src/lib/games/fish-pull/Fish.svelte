<script lang="ts">
  /** 位置はゲームループが el の transform に直接書く。Svelte が扱うのは暴れているかどうかだけ */
  let { el = $bindable(), thrashing }: { el?: HTMLDivElement; thrashing: boolean } = $props();
</script>

<div class="fish" class:thrashing bind:this={el} aria-hidden="true">
  <span class="body">
    <span class="eye"></span>
    <span class="fin"></span>
  </span>
  <span class="tail"></span>
  {#if thrashing}<span class="alert">！</span>{/if}
</div>

<style>
  .fish {
    position: absolute;
    left: 0;
    top: 0;
    width: 18%;
    aspect-ratio: 1.6;
    pointer-events: none;
    will-change: transform;
  }

  .body {
    position: absolute;
    inset: 12% 0 12% 18%;
    border: 4px solid #fff;
    border-radius: 55% 45% 45% 55% / 60% 60% 40% 40%;
    background: linear-gradient(to bottom, #ffb347, #ff7a1a);
    box-shadow: 0 5px 0 rgb(43 45 66 / 0.2);
    animation: swim 700ms ease-in-out infinite alternate;
  }

  .eye {
    position: absolute;
    top: 26%;
    right: 16%;
    width: 16%;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--ink);
  }

  .fin {
    position: absolute;
    top: -22%;
    left: 34%;
    width: 30%;
    height: 34%;
    border-radius: 80% 20% 0 0;
    background: #ff9a3c;
  }

  .tail {
    position: absolute;
    top: 18%;
    left: 0;
    width: 26%;
    height: 64%;
    clip-path: polygon(100% 50%, 0 0, 18% 50%, 0 100%);
    background: #ff7a1a;
    animation: wag 350ms ease-in-out infinite alternate;
  }

  .alert {
    position: absolute;
    top: -46%;
    left: 50%;
    translate: -50% 0;
    color: var(--p2);
    font-size: 30px;
    font-weight: 800;
    paint-order: stroke fill;
    -webkit-text-stroke: 6px #fff;
  }

  /* 暴れているときは大きく速く身をよじる */
  .thrashing .body {
    animation: thrash 120ms linear infinite alternate;
  }

  .thrashing .tail {
    animation-duration: 90ms;
  }

  @keyframes swim {
    to {
      rotate: 4deg;
    }
  }

  @keyframes wag {
    to {
      scale: 1 0.7;
    }
  }

  @keyframes thrash {
    from {
      rotate: -12deg;
    }
    to {
      rotate: 12deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .body,
    .tail {
      animation: none;
    }
  }
</style>
