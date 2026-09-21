<script lang="ts">
  import type { Color } from './engine';
  import { GLYPH, HEX } from './palette';

  let { color }: { color: Color } = $props();
</script>

<!-- お題は境界線の左右両端に出す。どちらのプレイヤーからも同じ距離で見える -->
{#key color}
  {#each ['left', 'right'] as side (side)}
    <span class="target {side}" style:--c={HEX[color]} aria-hidden="true">{GLYPH[color]}</span>
  {/each}
{/key}

<style>
  .target {
    position: absolute;
    top: 50%;
    display: grid;
    place-items: center;
    width: clamp(52px, 9dvh, 84px);
    aspect-ratio: 1;
    border: 5px solid #fff;
    /* 玉（丸）と見間違えないよう、お題は角丸の四角にする */
    border-radius: 24%;
    background: var(--c);
    box-shadow:
      0 0 0 4px rgb(0 0 0 / 0.35),
      0 0 22px var(--c);
    color: rgb(0 0 0 / 0.55);
    font-size: clamp(26px, 4.5dvh, 42px);
    translate: 0 -50%;
    animation: pop 400ms ease-out;
    pointer-events: none;
  }

  .target.left {
    left: max(10px, env(safe-area-inset-left));
  }

  .target.right {
    right: max(10px, env(safe-area-inset-right));
  }

  @keyframes pop {
    from {
      scale: 1.6;
    }
    to {
      scale: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .target {
      animation: none;
    }
  }
</style>
