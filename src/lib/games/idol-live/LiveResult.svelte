<script lang="ts">
  import type { Rank, Result } from './judge';
  import { NAMES, type Slot, type Theme } from './outfits';
  import ScoreCard from './ScoreCard.svelte';

  /** ライブのけっか。ステージの上にかぶせ、見出し・ランク・数字・ごほうびを順に出す */
  let {
    result,
    fans,
    record,
    unlocked,
    onagain,
    ondress
  }: {
    result: Result;
    fans: number;
    record: boolean;
    unlocked: { theme: Theme; slot: Slot }[];
    onagain: () => void;
    ondress: () => void;
  } = $props();

  const HEAD: Record<Rank, string> = {
    S: 'さいこうの ステージ！',
    A: 'ライブ だいせいこう！',
    B: 'ライブ せいこう！',
    C: 'さいごまで やりきった！'
  };
</script>

<div class="result" role="dialog" aria-label="ライブの けっか">
  <h2 class="head yuru">{HEAD[result.rank]}</h2>
  {#if result.fullCombo}<p class="fc">FULL COMBO!</p>{/if}
  <div class="card">
    <ScoreCard {result} {record} />
    <p class="fans">ファンが <b>{fans.toLocaleString()}</b> にん ふえた！</p>
    {#each unlocked as u (u.theme + u.slot)}
      <p class="new">あたらしい いしょう「{NAMES[u.theme][u.slot]}」を てにいれた！</p>
    {/each}
  </div>
  <div class="buttons">
    <button class="pill p1" onclick={ondress}>きがえる</button>
    <button class="pill gold go" onclick={onagain}>もういちど</button>
  </div>
</div>

<style>
  .result {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* 上半分はステージのミオを見せたまま、下に結果を重ねる */
    justify-content: flex-end;
    gap: clamp(8px, 1.6cqh, 18px);
    padding: 72px 16px max(24px, env(safe-area-inset-bottom));
    background: linear-gradient(transparent 30%, rgb(20 8 45 / 0.65));
    color: var(--line);
    animation: fade 500ms both;
  }

  .head {
    margin: 0;
    --fill: #ffe066;
    font-size: min(8cqw, 5cqh);
    text-align: center;
    animation: pop 600ms var(--spring) both 200ms;
  }

  .fc {
    margin: 0;
    color: #fff;
    font-weight: 800;
    font-size: clamp(18px, 3cqh, 30px);
    letter-spacing: 0.1em;
    text-shadow: 0 0 12px #ff6fa5;
  }

  .card {
    width: min(100%, 520px);
    padding: clamp(12px, 2cqh, 22px);
    border: 3px solid var(--line);
    border-radius: 24px;
    background: rgb(255 255 255 / 0.95);
    box-shadow: var(--soft-shadow);
    font-size: clamp(14px, min(2cqh, 3.8cqw), 20px);
    animation: rise 500ms var(--spring) both 400ms;
  }

  .fans,
  .new {
    margin: 6px 0 0;
    font-weight: 800;
    text-align: center;
  }

  .fans b {
    color: #ff5c9a;
  }

  .new {
    color: #8a5cff;
  }

  .buttons {
    display: flex;
    gap: 14px;
    animation: fade 300ms both 1400ms;
  }

  .buttons .pill {
    font-size: clamp(16px, 2.6cqh, 26px);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      translate: 0 40px;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .result,
    .head,
    .card,
    .buttons {
      animation: none;
    }
  }
</style>
