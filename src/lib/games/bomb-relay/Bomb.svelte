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
    background: radial-gradient(circle at 35% 30%, #69708a, #1b1e27 62%);
    box-shadow: 0 0 calc(8px + var(--heat) * 36px) calc(var(--heat) * 12px)
      rgb(255 90 40 / calc(0.25 + var(--heat) * 0.6));
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
