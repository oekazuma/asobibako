<script lang="ts">
  import { parseKey, RARITY_NAME, type GearKey } from './gear';
  import GearIcon from './GearIcon.svelte';

  /** delay は 10 連で順に割るための遅れ（秒） */
  let { gear, delay }: { gear: GearKey; delay: number } = $props();

  const p = $derived(parseKey(gear)!);
</script>

<div class="cap r{p.rarity}" style:--d="{delay}s">
  <span class="shell" aria-hidden="true"></span>
  <span class="item">
    <GearIcon {gear} size="min(9cqw, 5cqh, 44px)" />
    <small>{p.def.name}</small>
    <small class="rar">{RARITY_NAME[p.rarity]}</small>
  </span>
</div>

<style>
  .cap {
    --glow: #fff8ec;
    position: relative;
    display: grid;
    place-items: center;
    min-height: min(26cqw, 15cqh, 120px);
  }

  .r1 {
    --glow: #5ab0ff;
  }

  .r2 {
    --glow: #ffd84a;
  }

  /* 上半分が光の色、下半分が白のカプセルが落ちて揺れ、光ってから割れる */
  .shell {
    position: absolute;
    width: min(12cqw, 7cqh, 56px);
    aspect-ratio: 1;
    border: 3px solid #24151f;
    border-radius: 50%;
    background: linear-gradient(var(--glow) 50%, #fff8ec 50%);
    animation: drop 1s var(--d) both;
  }

  .item {
    display: grid;
    gap: 2px;
    justify-items: center;
    color: #fff8ec;
    font-size: min(2.6cqw, 1.5cqh, 13px);
    text-align: center;
    animation: open 0.5s calc(var(--d) + 0.9s) var(--spring, ease-out) both;
  }

  .rar {
    color: var(--glow);
    font-weight: 800;
  }

  @keyframes drop {
    0% {
      transform: translateY(-60%);
      opacity: 0;
    }
    30% {
      transform: none;
      opacity: 1;
    }
    45% {
      transform: rotate(-12deg);
    }
    60% {
      transform: rotate(12deg);
    }
    75% {
      transform: none;
      box-shadow: 0 0 0 0 var(--glow);
    }
    90% {
      transform: scale(1.2);
      box-shadow: 0 0 24px 10px var(--glow);
      opacity: 1;
    }
    100% {
      transform: scale(1.4);
      opacity: 0;
    }
  }

  @keyframes open {
    from {
      transform: scale(0.3);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shell {
      display: none;
    }

    .item {
      animation: none;
    }
  }
</style>
