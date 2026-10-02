<script lang="ts">
  import { grant, type AchievementDef } from './achievements';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { loadRecords, saveRecords } from './records';
  import Trophy from './Trophy.svelte';
  import { UPGRADES, buy, price, type UpgradeId } from './upgrades';

  let { onback }: { onback: () => void } = $props();

  let r = $state(loadRecords());
  let got = $state<AchievementDef[]>([]);
  const n = (v: number) => v.toLocaleString('ja-JP');

  function purchase(id: UpgradeId) {
    if (!buy(r, id)) return;
    got = grant(r, null);
    saveRecords($state.snapshot(r));
  }
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="パワーアップ">
    <h2 class="as-title">パワーアップ</h2>
    <p class="purse"><PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" /> {n(r.coins)}</p>
    {#each got as a (a.id)}
      <Trophy {a} />
    {/each}
    <div class="grid">
      {#each UPGRADES as d (d.id)}
        {@const rank = r.ranks[d.id] ?? 0}
        {@const full = rank >= d.max}
        <button
          class="as-card item"
          data-upgrade={d.id}
          disabled={full || r.coins < price(d, rank)}
          onclick={() => purchase(d.id)}
        >
          <PixelIcon art={ITEM_ART[d.icon]} size="min(9cqw, 5cqh, 48px)" />
          <span class="body">
            <b>{d.name}</b>
            <span class="pips">{'■'.repeat(rank)}{'□'.repeat(d.max - rank)}</span>
            <span class="blurb">{d.blurb}</span>
            <span class="price">{full ? 'MAX' : `${n(price(d, rank))} コイン`}</span>
          </span>
        </button>
      {/each}
    </div>
    <button class="as-card back" onclick={onback}>もどる</button>
  </section>
</div>

<style>
  .purse {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin: 0;
    color: #ffd84a;
    font-size: min(5cqw, 3cqh, 26px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
    gap: 8px;
  }

  .item:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .body {
    display: grid;
    gap: 2px;
    font-size: min(3.2cqw, 1.9cqh, 16px);
  }

  .pips {
    color: #d8463c;
    letter-spacing: 0.1em;
  }

  .blurb {
    color: #5d3a2a;
  }

  .price {
    color: #a3501c;
  }

  .back {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
