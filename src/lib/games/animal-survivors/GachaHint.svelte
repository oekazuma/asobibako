<script lang="ts">
  import type { Phase } from './gacha-show';
  import GachaList from './GachaList.svelte';
  import { parseKey, RARITY_NAME, type GearKey } from './gear';

  /** 段ごとの下の案内と、10 連を割り終えた並びと、伝説の閃光（flash が増えるたびに光る）。押すのは裏の canvas で受けるので、どれも指を通す */
  let { phase, gears, ready, flash }: { phase: Phase; gears: GearKey[]; ready: boolean; flash: number } = $props();

  const p = $derived(parseKey(gears[0]));
  const many = $derived(gears.length > 1);
</script>

{#if (phase === 'list' || phase === 'done') && many}
  <div class="list"><GachaList {gears} /></div>
{/if}
{#key flash}{#if flash}<div class="flash" aria-hidden="true"></div>{/if}{/key}
<p class="hint">
  {#if !ready}じゅんびちゅう…
  {:else if phase === 'ready'}ハンドルを まわしてね
  {:else if phase === 'wait'}{many ? 'おすと じゅんばんに ひらくよ' : 'カプセルを おしてね'}
  {:else if (phase === 'show' || phase === 'done') && !many && p}<b class="r{p.rarity}">{RARITY_NAME[p.rarity]}</b>
    {p.def.name}<small>おして とじる</small>
  {:else if (phase === 'list' || phase === 'done') && many}<small>おして とじる</small>{/if}
</p>

<style>
  .list {
    position: absolute;
    top: 14%;
    right: 0;
    left: 0;
    pointer-events: none;
  }

  .hint {
    position: absolute;
    right: 0;
    bottom: 10%;
    left: 0;
    display: grid;
    gap: 4px;
    justify-items: center;
    margin: 0;
    color: #fff8ec;
    font-size: min(5.4cqw, 3.2cqh, 28px);
    font-weight: 900;
    text-shadow: 0 2px 0 #24151f;
    pointer-events: none;
  }

  .hint small {
    color: #d8d0e8;
    font-size: 0.6em;
  }

  .r1 {
    color: #5ab0ff;
  }

  .r2 {
    color: #ffd84a;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #fff8ec;
    pointer-events: none;
    animation: flash 0.45s ease-out both;
  }

  @keyframes flash {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flash {
      display: none;
    }
  }
</style>
