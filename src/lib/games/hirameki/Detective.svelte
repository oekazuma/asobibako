<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  /** think は虫めがねをゆらして考えている。dots は吹き出しの「…」の数 */
  let { mood, dots = 0 }: { mood: 'think' | 'happy' | 'sad'; dots?: number } = $props();
</script>

<div class="detective" class:think={mood === 'think'} class:happy={mood === 'happy'} class:sad={mood === 'sad'}>
  {#if mood === 'think'}
    <span class="bubble">{'…'.repeat(dots)}</span>
  {:else if mood === 'happy'}
    {#each [0, 1, 2, 3] as i (i)}
      <span class="spark" style:--i={i}><Icon name="star" size="100%" /></span>
    {/each}
  {/if}
  <span class="face">
    <Icon name={mood === 'think' ? 'detective' : `detective-${mood}`} size="100%" />
  </span>
  <span class="lens"><Icon name="magnifier" size="100%" /></span>
</div>

<style>
  .detective {
    position: relative;
    width: min(22cqh, 34cqw);
    aspect-ratio: 1;
    animation: rise 420ms var(--spring);
  }

  @keyframes rise {
    from {
      translate: 0 30%;
      opacity: 0;
    }
  }

  .face {
    position: absolute;
    inset: 0;
    filter: drop-shadow(0 4px 0 rgb(91 74 66 / 0.25));
  }

  .lens {
    position: absolute;
    right: -22%;
    bottom: 8%;
    width: 48%;
    aspect-ratio: 1;
    transform-origin: 80% 80%;
  }

  .think .lens {
    animation: sway 700ms ease-in-out infinite alternate;
  }

  @keyframes sway {
    from {
      rotate: -18deg;
      translate: -8% 4%;
    }
    to {
      rotate: 14deg;
      translate: 6% -6%;
    }
  }

  .happy .lens {
    rotate: -30deg;
    translate: 0 -20%;
  }

  .sad .lens {
    rotate: 50deg;
    translate: 0 20%;
  }

  .sad .face {
    animation: droop 700ms ease-out forwards;
  }

  @keyframes droop {
    to {
      translate: 0 6%;
      rotate: -4deg;
    }
  }

  .bubble {
    position: absolute;
    bottom: 78%;
    left: 78%;
    min-width: 3.4em;
    padding: 4px 14px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-size: clamp(18px, 4cqh, 34px);
    font-weight: 800;
    text-align: left;
    white-space: nowrap;
  }

  .spark {
    position: absolute;
    top: calc(-10% + var(--i) * 18%);
    left: calc(var(--i) * 30% - 18%);
    width: 22%;
    aspect-ratio: 1;
    animation: twinkle 900ms ease-in-out calc(var(--i) * 150ms) infinite alternate;
  }

  @keyframes twinkle {
    from {
      scale: 0.4;
      opacity: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .detective,
    .think .lens,
    .sad .face,
    .spark {
      animation: none;
    }
  }
</style>
