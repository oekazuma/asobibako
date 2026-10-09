<script lang="ts">
  import { MODES, type Match } from './match.svelte';

  let { match }: { match: Match } = $props();
  const mode = $derived(MODES[match.view.settings.mode]);
</script>

{#if match.phase === 'intro'}
  <span class="bar top"></span>
  <span class="bar bottom"></span>
  <div class="intro" role="status">
    <p class="name" style:color={mode.color}>{mode.name}</p>
    <p>{mode.lines[0]}</p>
    <p>{mode.lines[1]}</p>
  </div>
{:else if match.phase === 'hide'}
  <p class="splash">隠れタイム</p>
{/if}

<style>
  .bar {
    position: absolute;
    right: 0;
    left: 0;
    height: 12cqh;
    background: #000;
    pointer-events: none;
  }

  .top {
    top: 0;
  }

  .bottom {
    bottom: 0;
  }

  .intro {
    position: absolute;
    inset: 12cqh 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 4px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 20px;
    text-shadow: 0 2px 6px #000;
    pointer-events: none;
  }

  .intro p {
    margin: 0;
  }

  .name {
    font-size: min(12cqh, 9cqw);
  }

  .splash {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: min(12cqh, 9cqw);
    text-shadow: 0 3px 10px #000;
    pointer-events: none;
    animation: splash 1.8s forwards;
  }

  @keyframes splash {
    0%,
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .splash {
      animation-duration: 0.01s;
      animation-delay: 1.2s;
    }
  }
</style>
