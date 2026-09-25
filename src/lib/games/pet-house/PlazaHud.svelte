<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import Adopt from './Adopt.svelte';
  import { BREEDS } from './breeds';
  import { adoptPrice } from './engine';
  import PlazaCard from './PlazaCard.svelte';
  import type { Plaza } from './plaza.svelte';
  import type { Session } from './session.svelte';

  let { plaza, session }: { plaza: Plaza; session: Session } = $props();

  const first = $derived(session.save.pets.length === 0);
  const price = $derived(adoptPrice(session.save));
  const short = $derived(Math.max(0, price - session.save.money));

  /** ひろばを出て部屋に戻ってからむかえる。その子が部屋の奥から歩いてくる */
  function welcome(name: string) {
    const breed = plaza.focus;
    if (!breed) return;
    plaza.end();
    session.adopt(breed, name);
  }
</script>

<div class="hud">
  <header class="bar">
    <span>ふれあいひろば</span>
    {#if !first}<span class="money"><Icon name="coin" />{session.save.money}</span>{/if}
  </header>

  {#if plaza.swapping}
    <p class="swap" role="status">ほかの子たちを よんでいるよ…</p>
  {:else if !plaza.focus}
    <div class="foot">
      <p class="hint">{first ? 'いっしょに くらす 子を さがそう。' : ''}きになる子に さわってみよう</p>
      <div class="row">
        <button class="pill gold" onclick={() => plaza.others()}>ほかの子たち</button>
        {#if !first}<button class="pill" onclick={() => plaza.end()}>おうちへ もどる</button>{/if}
      </div>
    </div>
  {:else}
    <section class="panel" aria-label="{BREEDS[plaza.focus].name}の しょうかい">
      {#if plaza.step === 'look'}
        <PlazaCard {plaza} breed={plaza.focus} {price} {short} />
      {:else}
        <Adopt breed={plaza.focus} {price} onname={welcome} onback={() => plaza.go('look')} />
      {/if}
    </section>
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

  .bar,
  .foot > *,
  .panel {
    pointer-events: auto;
  }

  .bar,
  .hint,
  .swap {
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    font-weight: 800;
  }

  .bar,
  .money {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .money {
    gap: 2px;
  }

  /* 隅の ✕ と ↻ にかからないよう、まん中に細く置く */
  .bar {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    padding: 6px 16px;
    box-shadow: var(--soft-shadow);
    font-size: clamp(14px, 2.4cqw, 18px);
    white-space: nowrap;
    translate: -50% 0;
  }

  .foot {
    position: absolute;
    right: 12px;
    bottom: max(20px, env(safe-area-inset-bottom));
    left: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .swap {
    position: absolute;
    top: 45%;
    left: 50%;
    margin: 0;
    padding: 12px 24px;
    box-shadow: var(--soft-shadow);
    white-space: nowrap;
    translate: -50% -50%;
  }

  .hint {
    margin: 0;
    padding: 8px 18px;
    text-align: center;
    word-break: keep-all;
  }

  .panel {
    position: absolute;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 560px;
    max-height: 58cqh;
    margin: 0 auto;
    overflow-y: auto;
    padding: 16px;
    border: 3px solid var(--line);
    border-radius: 26px;
    background: var(--paper-dots), var(--paper);
    box-shadow: var(--soft-shadow);
    text-align: center;
    touch-action: pan-y;
    animation: rise 380ms var(--spring);
  }

  @keyframes rise {
    from {
      translate: 0 40px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
