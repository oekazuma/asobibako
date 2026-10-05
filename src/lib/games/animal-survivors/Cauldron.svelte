<script lang="ts">
  import Back from './Back.svelte';
  import { CAULDRON_ART } from './art/cauldron';
  import { atkMul, betOf, chestOdds, coinMul, heatLabel, hpMul, maxHeat, snap } from './cauldron';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { stageOf } from './stages';

  let {
    coins,
    start,
    stage,
    onstart,
    onback
  }: { coins: number; start: number; stage: string; onstart: (h: number) => void; onback: () => void } = $props();

  const top = $derived(maxHeat(coins));
  // svelte-ignore state_referenced_locally
  let h = $state(snap(Math.min(start, maxHeat(coins))));
  const bet = $derived(betOf(h));
  const rich = $derived(Math.round((1 - chestOdds(h).one) * 100));
  const flame = $derived(h < 4 ? 0 : h < 7 ? 1 : 2);
  const x = (v: number) => `×${v.toFixed(2).replace(/\.?0+$/, '')}`;
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="まじょの釜">
    <h2 class="as-title">まじょの釜</h2>
    <p class="where">{stageOf(stage).name}</p>
    <div class="pot"><PixelIcon art={CAULDRON_ART} frame={flame} size="min(30cqw, 18cqh, 160px)" /></div>
    <p class="heat" data-flame={flame}>{heatLabel(h)}</p>
    <div class="dial">
      <button class="as-card step" aria-label="弱くする" disabled={h <= 0} onclick={() => (h = snap(h - 0.1))}>−</button
      >
      <input
        type="range"
        min="0"
        max={top}
        step="0.1"
        value={h}
        aria-label="釜の強さ"
        oninput={(e) => (h = snap(Number(e.currentTarget.value)))}
      />
      <button class="as-card step" aria-label="強くする" disabled={h >= top} onclick={() => (h = snap(h + 0.1))}
        >+</button
      >
    </div>
    <dl class="rows">
      <dt>敵の体力</dt>
      <dd>{x(hpMul(h))}</dd>
      <dt>敵の攻撃</dt>
      <dd>{x(atkMul(h))}</dd>
      <dt>コイン</dt>
      <dd>{x(coinMul(h))}</dd>
      <dt>宝箱が豪華</dt>
      <dd>{rich}%</dd>
    </dl>
    <p class="bet">
      <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" />
      {#if bet > 0}賭ける {bet}（倒れると戻らない）{:else}賭けなし{/if}
    </p>
    <p class="have">もちもの {coins.toLocaleString('ja-JP')}</p>
    <button class="as-card as-go go" data-start onclick={() => onstart(h)}>はじめる</button>
  </section>
</div>
<Back {onback} />

<style>
  .where,
  .have {
    margin: 0;
    text-align: center;
    font-size: min(3.6cqw, 2.2cqh, 18px);
  }

  .pot {
    display: flex;
    justify-content: center;
  }

  .heat {
    margin: 0;
    text-align: center;
    font-size: min(14cqw, 8cqh, 72px);
    line-height: 1;
    color: #8fd2ff;
    text-shadow: 3px 3px 0 #24151f;
  }

  .heat[data-flame='1'] {
    color: #c79cff;
  }

  .heat[data-flame='2'] {
    color: #ff8a5c;
  }

  .dial {
    display: flex;
    gap: min(2cqw, 12px);
    align-items: center;
  }

  .dial input {
    flex: 1;
    min-width: 0;
    height: 40px;
    accent-color: #ffd84a;
    /* 回した画面ではつまみの向きとスクロールの向きが重なるので、つまみの上では画面を動かさない */
    touch-action: none;
  }

  .step {
    justify-content: center;
    width: min(12cqw, 56px);
    font-size: min(6cqw, 3.6cqh, 30px);
  }

  .step:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .rows {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 16px;
    margin: 0;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .rows dd {
    margin: 0;
    color: #ffd84a;
  }

  .bet {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .go {
    justify-content: center;
    font-size: min(5.4cqw, 3.2cqh, 28px);
  }
</style>
