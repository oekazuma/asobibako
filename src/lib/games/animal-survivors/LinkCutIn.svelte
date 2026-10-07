<script lang="ts">
  import type { AnimalId } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import PixelIcon from './PixelIcon.svelte';

  let { a, b, name }: { a: AnimalId; b: AnimalId; name: string } = $props();
  // 長い名前の途中で折り返さないよう、2 つの半分を 1 行ずつに分ける
  const parts = $derived(name.split(' × '));
</script>

<div class="plate" role="alert">
  <span class="faces">
    <PixelIcon art={ANIMAL_ART[a].forms[0].walk} size="min(14cqw, 8cqh, 72px)" />
    <b>×</b>
    <PixelIcon art={ANIMAL_ART[b].forms[0].walk} size="min(14cqw, 8cqh, 72px)" />
  </span>
  <strong>
    {#each parts as part, i (part)}<span>{i ? `× ${part}` : part}</span>{/each}
  </strong>
</div>

<style>
  .plate {
    position: absolute;
    /* 2 匹と技の絵を隠さないよう、HUD のすぐ下に出す */
    top: 16%;
    left: 50%;
    z-index: 4;
    display: grid;
    place-items: center;
    gap: 6px;
    padding: min(1.4cqh, 10px) min(5cqw, 28px);
    border: 4px solid #24151f;
    background: rgb(36 21 31 / 0.88);
    box-shadow: 0 0 0 3px #ffd84a;
    color: #fff;
    font-weight: 900;
    max-width: calc(100% - 24px);
    translate: -50% 0;
    pointer-events: none;
    animation: enter 300ms steps(5);
  }

  .faces {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .faces b {
    color: #ffd84a;
    font-size: min(7cqw, 4.2cqh, 40px);
  }

  strong {
    display: grid;
    white-space: nowrap;
    text-align: center;
    font-size: min(5.4cqw, 3.2cqh, 32px);
    letter-spacing: 0.04em;
    text-shadow:
      3px 3px 0 #e09a1c,
      -2px -2px 0 #24151f;
  }

  @keyframes enter {
    from {
      scale: 1.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .plate {
      animation: none;
    }
  }
</style>
