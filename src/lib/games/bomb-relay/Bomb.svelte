<script lang="ts">
  import type { Player } from '$lib/player';
  import { BOMB_R } from './engine';

  /** 位置・脈・熱はゲームループが毎フレーム el に直接書く。Svelte が扱うのは持ち主と有無だけ */
  let { el = $bindable(), heldBy, gone }: { el?: HTMLDivElement; heldBy: Player | null; gone: boolean } = $props();
</script>

<div
  bind:this={el}
  class="bomb {heldBy ? `held p${heldBy}` : ''}"
  class:gone
  style:--size="{BOMB_R * 200}%"
  aria-hidden="true"
>
  <span class="wick"><span class="spark"></span><span class="cord"></span><span class="cap"></span></span>
</div>

<style>
  .bomb {
    --heat: 0;
    position: absolute;
    left: 0;
    top: 0;
    height: var(--size);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 4px solid #fff;
    background: radial-gradient(circle at 35% 30%, #6d7390, #2b2d42 62%);
    pointer-events: none;
    will-change: transform;
  }

  /* 熱いほど赤く染まる */
  .bomb::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: #ff4b2b;
    opacity: calc(var(--heat) * 0.65);
  }

  /* 熱いほど強く光る。ぼかしの大きさを毎フレーム変えると iOS で描き直しが重いので、大きさは固定して opacity だけ動かす */
  .bomb::after {
    content: '';
    position: absolute;
    inset: -4px;
    z-index: -1;
    border-radius: 50%;
    box-shadow: 0 0 44px 12px rgb(255 90 40 / 0.85);
    opacity: calc(0.3 + var(--heat) * 0.7);
    will-change: opacity;
  }

  /* 右上に斜めに立つ口金と導火線。熱いほど導火線が短くなり、火花が口金に近づく */
  .wick {
    position: absolute;
    bottom: 72%;
    left: 70%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 34%;
    height: 56%;
    rotate: 40deg;
    transform-origin: bottom center;
  }

  .cap {
    flex: none;
    width: 70%;
    height: 22%;
    border: 3px solid #fff;
    border-radius: 6px;
    background: #4a4f68;
  }

  .cord {
    flex: none;
    width: 14%;
    height: calc((1 - var(--heat)) * 60%);
    border-radius: 999px;
    background: #c8a06a;
  }

  .spark {
    flex: none;
    width: 90%;
    aspect-ratio: 1;
    margin-bottom: -30%;
    border-radius: 50%;
    background: radial-gradient(circle, #fff6c2, #ffb020 45%, transparent 70%);
    animation: flicker 120ms steps(2) infinite;
  }

  @keyframes flicker {
    50% {
      scale: 0.75;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spark {
      animation: none;
    }
  }

  .held.p1 {
    outline: 4px solid var(--p1);
    outline-offset: 4px;
  }

  .held.p2 {
    outline: 4px solid var(--p2);
    outline-offset: 4px;
  }

  .gone {
    visibility: hidden;
  }
</style>
