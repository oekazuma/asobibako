<script lang="ts">
  import { ACHIEVEMENTS } from './achievements';
  import { GEAR_ART } from './art/gear';
  import { ITEM_ART } from './art/items';
  import { MENU_ART } from './art/menu';
  import { PITY, wornKeys } from './gacha';
  import GearIcon from './GearIcon.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';

  const TICKETS = [0, 1, 2] as const;
  type Menu = 'gacha' | 'shop' | 'gear' | 'trophies' | 'book';
  let { records, onopen }: { records: Records; onopen: (m: Menu) => void } = $props();
</script>

<!-- よく開くものほど大きく上に置く -->
<div class="menu">
  <button class="as-card big" data-menu="gacha" onclick={() => onopen('gacha')}>
    <PixelIcon art={MENU_ART.gacha} size="min(10cqw, 6cqh, 52px)" />
    <span class="text">
      <b>ガチャ</b>
      <small class="tickets">
        {#each TICKETS as t (t)}<span
            ><PixelIcon art={GEAR_ART[`ticket${t}`]} size="min(3.6cqw, 2.2cqh, 20px)" />×{records.tickets[t]}</span
          >{/each}
        <span>伝説まであと {PITY - records.pity} 回</span>
      </small>
    </span>
  </button>
  <div class="row">
    <button class="as-card mid" data-menu="shop" onclick={() => onopen('shop')}>
      <PixelIcon art={ITEM_ART.coin} size="min(6cqw, 3.6cqh, 32px)" /><span class="text"
        >パワーアップ<small>{records.coins.toLocaleString('ja-JP')}</small></span
      >
    </button>
    <button class="as-card mid" data-menu="gear" onclick={() => onopen('gear')}>
      <PixelIcon art={MENU_ART.gear} size="min(6cqw, 3.6cqh, 32px)" /><span class="text"
        >装備<small class="worn"
          >{#each wornKeys(records) as k (k)}<GearIcon gear={k} size="min(3cqw, 2cqh, 18px)" />{/each}</small
        ></span
      >
    </button>
  </div>
  <div class="row">
    <button class="as-card small" data-menu="trophies" onclick={() => onopen('trophies')}>
      <PixelIcon art={MENU_ART.trophy} size="min(4.4cqw, 2.6cqh, 24px)" />実績 {records.achieved.length} / {ACHIEVEMENTS.length}
    </button>
    <button class="as-card small" data-menu="book" onclick={() => onopen('book')}>
      <PixelIcon art={MENU_ART.book} size="min(4.4cqw, 2.6cqh, 24px)" />図鑑
    </button>
  </div>
</div>

<style>
  .menu {
    display: grid;
    gap: 8px;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .as-card {
    gap: 10px;
    justify-content: center;
  }

  .text {
    display: grid;
    white-space: nowrap;
    gap: 2px;
    justify-items: start;
  }

  .big {
    padding-block: min(1.6cqh, 12px);
    background: #ffd84a;
    font-size: min(6cqw, 3.4cqh, 30px);
  }

  .tickets {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    align-items: center;
    color: #5d3a2a;
    font-size: 0.5em;
  }

  .tickets span {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }

  .mid {
    font-size: min(3.8cqw, 2.4cqh, 21px);
  }

  .mid small {
    color: #8a6a4a;
    font-size: 0.7em;
  }

  .worn {
    display: flex;
    gap: 2px;
    min-height: 1em;
  }

  .small {
    padding-block: min(0.6cqh, 5px);
    background: #e8dcc4;
    font-size: min(3.4cqw, 2cqh, 17px);
  }
</style>
