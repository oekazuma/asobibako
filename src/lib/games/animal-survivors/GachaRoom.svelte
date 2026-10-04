<script lang="ts">
  import { ITEM_ART } from './art/items';
  import Gacha from './Gacha.svelte';
  import Gacha3D from './Gacha3D.svelte';
  import GachaOdds from './GachaOdds.svelte';
  import { BAG_MAX, bagCount, pull, type PullWay } from './gacha';
  import type { GearKey } from './gear';
  import PixelIcon from './PixelIcon.svelte';
  import { loadRecords, saveRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  let r = $state(loadRecords());
  let odds = $state(false);
  /** 引いたあとに開く 3D の演出の品。枠の中だと全画面に広がらないので画面の外に置く */
  let three = $state<GearKey[] | null>(null);

  function onpull(way: PullWay) {
    const got = pull(r, way, Math.random);
    if (!got) return null;
    saveRecords($state.snapshot(r));
    three = got;
    return got;
  }
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="ガチャ">
    <h2 class="as-title">ガチャ</h2>
    <p class="purse">
      <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" />
      {r.coins.toLocaleString('ja-JP')}<span class="count">持ち物 {bagCount(r)} / {BAG_MAX}</span>
    </p>
    <Gacha {r} {onpull} />
    <button class="as-card toggle" onclick={() => (odds = !odds)}>{odds ? 'かくりつを とじる' : 'かくりつ'}</button>
    {#if odds}<GachaOdds />{/if}
    <button class="as-card back" onclick={onback}>もどる</button>
  </section>
</div>
{#if three}<Gacha3D gears={three} onclose={() => (three = null)} />{/if}

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

  .count {
    margin-left: 12px;
    color: #bcc4ce;
    font-size: 0.6em;
  }

  .toggle,
  .back {
    justify-content: center;
    font-size: min(4.2cqw, 2.5cqh, 22px);
  }
</style>
