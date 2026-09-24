<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { LENGTH } from './walk';
  import type { WalkPlay } from './walk.svelte';

  let { walk }: { walk: WalkPlay } = $props();

  const left = $derived(Math.max(0, LENGTH - walk.meters));
</script>

<div class="hud">
  <header class="bar">
    <span class="stat"><Icon name="paw" />{walk.meters}m</span>
    <span class="track" aria-hidden="true"
      ><span class="fill" style:width="{(walk.meters / LENGTH) * 100}%"></span></span
    >
    <span class="goal"><Icon name="pine" />こうえんまで {left}m</span>
  </header>

  <button class="pill p2 home" onclick={() => walk.home()}><Icon name="house" />おうちへ</button>
  {#if walk.poop}
    <button class="bag" aria-label="ふくろで うんちを ひろう" onclick={() => walk.pick()}>
      <Icon name="bag" size="56%" /><span>ふくろ</span>
    </button>
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    color: var(--line);
  }

  .hud > * {
    pointer-events: auto;
  }

  .bar {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px 6px 8px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    font-weight: 800;
    white-space: nowrap;
    translate: -50% 0;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--pastel-gold);
    font-size: clamp(14px, 2.8cqw, 22px);
    font-variant-numeric: tabular-nums;
  }

  .track {
    width: clamp(60px, 22cqw, 220px);
    height: 12px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--pastel-p1);
  }

  .goal {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: clamp(12px, 2.2cqw, 17px);
  }

  .home {
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: max(14px, env(safe-area-inset-left));
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .bag {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(16px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: clamp(64px, min(14cqw, 10cqh), 96px);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 24%;
    background: var(--pastel-gold);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    font-size: clamp(11px, 2.4cqw, 16px);
    animation: nudge 900ms var(--spring) infinite alternate;
    cursor: pointer;
  }

  .bag:active {
    translate: 0 3px;
    box-shadow: var(--soft-press);
  }

  @keyframes nudge {
    to {
      scale: 1.08;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bag {
      animation: none;
    }
  }

  @container (max-width: 520px) {
    .goal {
      display: none;
    }
  }
</style>
