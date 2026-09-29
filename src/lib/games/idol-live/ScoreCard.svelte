<script lang="ts">
  import type { Result } from './judge';

  /** けっかのカードの上半分。ランクのはんこ・スコア・判定ごとの数 */
  let { result, record }: { result: Result; record: boolean } = $props();

  const rows = $derived([
    ['PERFECT', result.perfect],
    ['GREAT', result.great],
    ['GOOD', result.good],
    ['MISS', result.miss],
    ['MAX COMBO', result.maxCombo],
    ['SPECIAL', `${result.specials} / ${result.specialTotal}`]
  ]);
</script>

<div class="top">
  <span class="rank rank-{result.rank}"><span class="sr-only">ランク</span>{result.rank}</span>
  <div class="score">
    <span class="caption">SCORE</span>
    <b>{result.score.toLocaleString()}</b>
    {#if record}<span class="record">ハイスコア！</span>{/if}
  </div>
</div>
<dl>
  {#each rows as [k, v], i (k)}
    <div class="row" style:--i={i}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  {/each}
  {#if result.bonus > 0}
    <div class="row" style:--i={6}>
      <dt>コーデ ボーナス</dt>
      <dd>+{Math.round(result.bonus * 100)}%</dd>
    </div>
  {/if}
</dl>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .rank {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.2em;
    height: 2.2em;
    border: 4px solid var(--line);
    border-radius: 50%;
    color: #fff;
    font-weight: 900;
    font-size: clamp(40px, 7cqh, 72px);
    line-height: 1;
    animation: stamp 500ms var(--spring) both 1100ms;
  }

  .rank-S {
    background: linear-gradient(135deg, #ffd43b, #ff6fa5, #8ec9ff);
  }
  .rank-A {
    background: #ff6fa5;
  }
  .rank-B {
    background: #4fa8ff;
  }
  .rank-C {
    background: #9a8aa8;
  }

  .score {
    display: grid;
  }

  .caption {
    font-size: 0.8em;
  }

  .score b {
    font-size: 2em;
    font-variant-numeric: tabular-nums;
  }

  .record {
    color: #ff5c9a;
    font-weight: 800;
  }

  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 20px;
    margin: 12px 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    border-bottom: 2px dotted #e8d6de;
    animation: fade 300ms both calc(600ms + var(--i) * 80ms);
  }

  dt {
    font-weight: 800;
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes stamp {
    from {
      scale: 2.5;
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rank,
    .row {
      animation: none;
    }
  }
</style>
