<script lang="ts">
  import type { Player } from '$lib/player';
  import type { Orb } from './engine';

  let {
    orbs,
    holding,
    ongrab,
    onrelease
  }: {
    orbs: Orb[];
    holding: number[];
    ongrab: (event: PointerEvent, orb: Orb, by: Player) => void;
    onrelease: (id: number) => void;
  } = $props();

  const label = (orb: Orb, by: Player) =>
    `プレイヤー${by}の${orb.kind === 'hold' ? '長押しの玉' : orb.kind === 'contest' ? '奪い合いの玉' : '玉'}`;
</script>

{#each orbs as orb (orb.id)}
  {#if orb.owner !== null}
    <button
      class="orb {orb.kind} p{orb.owner}"
      class:holding={holding.includes(orb.id)}
      style:left="{orb.x * 100}%"
      style:top="{orb.y * 100}%"
      aria-label={label(orb, orb.owner)}
      onpointerdown={(e) => ongrab(e, orb, orb.owner as Player)}
      onpointerup={() => onrelease(orb.id)}
      onpointercancel={() => onrelease(orb.id)}
    >
      {#if orb.kind === 'hold'}<span class="fill"></span>{/if}
    </button>
  {/if}
{/each}

<!-- 奪い合いの玉だけは境界線に乗るので、境界と一緒に動く層に置く -->
<div class="border-layer">
  {#each orbs as orb (orb.id)}
    {#if orb.owner === null}
      <div class="contest" style:left="{orb.x * 100}%">
        <button class="contest-half top" aria-label={label(orb, 2)} onpointerdown={(e) => ongrab(e, orb, 2)}></button>
        <button class="contest-half bottom" aria-label={label(orb, 1)} onpointerdown={(e) => ongrab(e, orb, 1)}
        ></button>
      </div>
    {/if}
  {/each}
</div>

<style>
  .orb {
    position: absolute;
    width: max(52px, 10dvh);
    height: max(52px, 10dvh);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: currentColor;
    translate: -50% -50%;
    animation: life var(--life) linear forwards;
    touch-action: none;
    cursor: pointer;
  }

  .orb.p1 {
    color: var(--p1);
  }

  .orb.p2 {
    color: var(--p2);
  }

  .orb.hold {
    display: grid;
    place-items: center;
    border: 6px solid currentColor;
    background: transparent;
  }

  .fill {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: currentColor;
    transform: scale(0);
  }

  .orb.holding .fill {
    animation: fill var(--hold) linear forwards;
  }

  .border-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transform: translateY(calc((var(--b) - 0.5) * 100%));
    transition: transform 160ms ease-out;
  }

  .contest {
    position: absolute;
    top: 50%;
    width: max(58px, 11dvh);
    height: max(58px, 11dvh);
    translate: -50% -50%;
    pointer-events: auto;
    animation: life var(--life) linear forwards;
  }

  .contest-half {
    position: absolute;
    left: 0;
    width: 100%;
    height: 50%;
    padding: 0;
    border: none;
    background: var(--gold);
    touch-action: none;
    cursor: pointer;
  }

  .contest-half.top {
    top: 0;
    border-radius: 999px 999px 0 0;
    box-shadow: inset 0 3px 0 var(--p2);
  }

  .contest-half.bottom {
    bottom: 0;
    border-radius: 0 0 999px 999px;
    box-shadow: inset 0 -3px 0 var(--p1);
  }

  @keyframes life {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    10% {
      transform: scale(1);
      opacity: 1;
    }
    80% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(0.6);
      opacity: 0.35;
    }
  }

  @keyframes fill {
    to {
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .border-layer {
      transition: none;
    }

    .orb,
    .contest {
      animation-name: none;
    }
  }
</style>
