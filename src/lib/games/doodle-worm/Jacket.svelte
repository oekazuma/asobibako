<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Level } from './dance';

  let { level }: { level: Level } = $props();
</script>

<!-- 曲のジャケット。画像は持たず、曲ごとの 2 色と絵で描く -->
<span class="jacket" style:--a={level.jacket.colors[0]} style:--b={level.jacket.colors[1]}>
  <span class="art"><Icon name={level.jacket.icon} size="100%" /></span>
  <span class="art small"><Icon name={level.jacket.icon} size="100%" /></span>
  <span class="title">{level.name}</span>
  {#if level.credit}<span class="credit">{level.credit}</span>{/if}
</span>

<style>
  .jacket {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 5px solid #fff;
    border-radius: 24px;
    background:
      radial-gradient(circle at 20% 20%, rgb(255 255 255 / 0.55) 0 3%, transparent 3.5%),
      radial-gradient(circle at 80% 30%, rgb(255 255 255 / 0.45) 0 2%, transparent 2.5%),
      radial-gradient(circle at 70% 85%, rgb(255 255 255 / 0.4) 0 2.5%, transparent 3%),
      repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.1) 0 12px, transparent 12px 24px),
      linear-gradient(160deg, var(--a), var(--b));
    box-shadow: var(--lift);
    color: var(--line);
  }

  .art {
    position: absolute;
    top: 12%;
    left: 50%;
    width: 52%;
    translate: -50% 0;
    rotate: -10deg;
    filter: drop-shadow(0 4px 0 rgb(0 0 0 / 0.15));
  }

  .art.small {
    top: 8%;
    left: 82%;
    width: 18%;
    rotate: 16deg;
    opacity: 0.85;
  }

  .title {
    position: absolute;
    right: 8px;
    bottom: 14%;
    left: 8px;
    color: #fff;
    font-size: clamp(14px, 4.4cqw, 26px);
    font-weight: 900;
    text-align: center;
    line-height: 1.15;
    text-shadow:
      0 2px 0 var(--line),
      2px 0 0 var(--line),
      -2px 0 0 var(--line),
      0 -2px 0 var(--line);
  }

  .credit {
    position: absolute;
    right: 0;
    bottom: 4%;
    left: 0;
    color: #fff;
    font-size: clamp(9px, 2.2cqw, 13px);
    font-weight: 800;
    text-align: center;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  }
</style>
