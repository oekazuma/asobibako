<script lang="ts" module>
  /** 消えた玉の位置（盤面に対する 0..1）と色 */
  export interface Pop {
    id: number;
    x: number;
    y: number;
    color: string;
  }
</script>

<script lang="ts">
  let { pops }: { pops: Pop[] } = $props();
</script>

<!-- 玉を消した場所で、輪と粒が弾ける。古いものは描き終えて透明のまま残り、数個で入れ替わる -->
{#each pops as pop (pop.id)}
  <div class="pop" style:left="{pop.x * 100}%" style:top="{pop.y * 100}%" style:color={pop.color} aria-hidden="true">
    {#each [0, 1, 2, 3, 4, 5] as i (i)}
      <span class="bit" style:--a="{i * 60 + 30}deg"></span>
    {/each}
  </div>
{/each}

<style>
  .pop {
    position: absolute;
    height: max(52px, 10%);
    aspect-ratio: 1;
    translate: -50% -50%;
    pointer-events: none;
  }

  .pop::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 5px solid currentColor;
    border-radius: 50%;
    animation: ring 380ms ease-out forwards;
  }

  .bit {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16%;
    aspect-ratio: 1;
    margin: -8% 0 0 -8%;
    border: 2px solid #fff;
    border-radius: 50%;
    background: currentColor;
    animation: bit 420ms ease-out forwards;
  }

  @keyframes ring {
    from {
      scale: 0.8;
      opacity: 0.9;
    }
    to {
      scale: 1.7;
      opacity: 0;
    }
  }

  /* 粒の大きさ（玉の 16%）の 5 倍ほど、それぞれの向きへ飛ぶ */
  @keyframes bit {
    from {
      transform: rotate(var(--a)) translateY(0);
      opacity: 1;
    }
    to {
      transform: rotate(var(--a)) translateY(-500%);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pop {
      display: none;
    }
  }
</style>
