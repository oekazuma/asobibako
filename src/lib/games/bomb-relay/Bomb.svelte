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
  <span class="spark"></span>
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

  .spark {
    position: absolute;
    top: -12%;
    right: 4%;
    width: 30%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, #fff6c2, #ffb020 45%, transparent 70%);
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
