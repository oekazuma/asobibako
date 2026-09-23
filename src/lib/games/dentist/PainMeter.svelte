<script lang="ts">
  import type { Expression } from './animals';

  let { pain, face }: { pain: number; face: Expression } = $props();
</script>

<div
  class="pain"
  class:hot={pain >= 0.6}
  role="meter"
  aria-label="いたいメーター"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(pain * 100)}
>
  <span class="face" data-face={face}></span>
  <span class="bar"><i style:width="{Math.round(pain * 100)}%"></i></span>
</div>

<style>
  .pain {
    position: absolute;
    top: max(14px, env(safe-area-inset-top));
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px 5px 5px;
    border: 4px solid #5b4a42;
    border-radius: 999px;
    background: #fff;
    translate: -50% 0;
    pointer-events: none;
  }

  .face {
    position: relative;
    width: 30px;
    height: 30px;
    border: 3px solid #5b4a42;
    border-radius: 50%;
    background: #ffd9b8;
  }

  .face::before {
    content: '';
    position: absolute;
    inset: 9px 6px auto;
    height: 5px;
    border-inline: 5px solid #5b4a42;
  }

  .face::after {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 5px;
    height: 5px;
    border-bottom: 3px solid #5b4a42;
    border-radius: 0 0 8px 8px;
  }

  .face[data-face='nervous']::after,
  .face[data-face='hurt']::after,
  .face[data-face='cry']::after {
    border-top: 3px solid #5b4a42;
    border-bottom: 0;
    border-radius: 8px 8px 0 0;
  }

  .bar {
    width: min(26cqw, 160px);
    height: 16px;
    border: 3px solid #5b4a42;
    border-radius: 8px;
    background: #f2e7d4;
    overflow: hidden;
  }

  .bar i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #ffb13d, #ff4d5e);
    transition: width 150ms;
  }

  .hot {
    animation: throb 600ms ease-in-out infinite alternate;
  }

  @keyframes throb {
    to {
      scale: 1.06;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hot {
      animation: none;
    }
  }
</style>
