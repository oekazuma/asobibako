<script lang="ts">
  import Figure from './Figure.svelte';
  import { sounds } from './sounds';
  import type { Figure as Fig, TapQ } from './types';

  let {
    fig,
    spots,
    max,
    picked = $bindable([])
  }: { fig: Fig; spots: TapQ['spots']; max: number; picked?: number[] } = $props();

  function toggle(i: number) {
    if (picked.includes(i)) picked = picked.filter((j) => j !== i);
    // 1 つだけ選ぶなぞは、別の場所を押せば選び直しになる
    else if (max === 1) picked = [i];
    else if (picked.length < max) picked = [...picked, i];
    else return;
    sounds.pick();
  }
</script>

<Figure {fig}>
  {#each spots as spot, i (spot)}
    <button
      class="spot"
      class:on={picked.includes(i)}
      style:left="{(spot.x / fig.w) * 100}%"
      style:top="{(spot.y / fig.h) * 100}%"
      style:width="{((spot.r * 2) / fig.w) * 100}%"
      aria-label="場所 {i + 1}"
      aria-pressed={picked.includes(i)}
      onclick={() => toggle(i)}
    ></button>
  {/each}
</Figure>

<style>
  /* 押せる場所は、どれも同じ点線の丸で見せる（どこを押せばよいか迷わないように） */
  .spot {
    position: absolute;
    aspect-ratio: 1;
    padding: 0;
    border: 3px dashed rgb(91 74 66 / 0.55);
    border-radius: 50%;
    background: rgb(255 255 255 / 0.35);
    translate: -50% -50%;
    cursor: pointer;
  }

  .spot:active {
    background: rgb(255 255 255 / 0.6);
  }

  .spot.on {
    border: 5px solid #ff4d6d;
    background: rgb(255 77 109 / 0.15);
    box-shadow:
      0 0 0 3px #fff,
      inset 0 0 0 3px #fff;
    animation: pop 300ms var(--spring);
  }

  @keyframes pop {
    from {
      scale: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spot.on {
      animation: none;
    }
  }
</style>
