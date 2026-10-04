<script lang="ts">
  import { GEAR_ART } from './art/gear';
  import { ITEM_ART } from './art/items';
  import {
    BAG_MAX,
    bagCount,
    ODDS,
    percent,
    PITY,
    PULL_COINS,
    TEN_COINS,
    TICKET_NAME,
    whyNot,
    type PullWay
  } from './gacha';
  import type { GearKey } from './gear';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';

  /** 記録を書き換えて保存し、引いた品を見せるのはガチャの画面。ここは引き方のカードだけ */
  let { r, onpull }: { r: Records; onpull: (way: PullWay) => GearKey[] | null } = $props();

  const TICKETS: [PullWay, 0 | 1 | 2][] = [
    ['bronze', 0],
    ['silver', 1],
    ['gold', 2]
  ];
  const COIN_STACK = [0, 1, 2] as const;
  const one = $derived(whyNot(r, 'coin'));
  const ten = $derived(whyNot(r, 'ten'));
</script>

<section class="gacha" aria-label="引き方">
  <div class="pity">
    <span>伝説まで</span>
    <span class="bar" aria-hidden="true"><span style:width="{(r.pity / PITY) * 100}%"></span></span>
    <b>あと {PITY - r.pity} 回</b>
  </div>
  <div class="tickets">
    {#each TICKETS as [way, t] (way)}
      {@const why = whyNot(r, way)}
      <button class="pick t{t}" data-way={way} disabled={why !== null} onclick={() => onpull(way)}>
        <small>{TICKET_NAME[t]}</small>
        <PixelIcon art={GEAR_ART[`ticket${t}`]} size="min(13cqw, 7.5cqh, 64px)" />
        <b>×{r.tickets[t]}</b>
        <small class="odds">伝説 {percent(ODDS[t][2])}</small>
        {#if why}<small class="why">{why}</small>{/if}
      </button>
    {/each}
  </div>
  <div class="coins">
    <button class="pick one" data-way="coin" disabled={one !== null} onclick={() => onpull('coin')}>
      <small>1 回</small>
      <span class="price"><PixelIcon art={ITEM_ART.coin} size="min(6cqw, 3.5cqh, 30px)" />{PULL_COINS}</span>
      {#if one}<small class="why">{one}</small>{/if}
    </button>
    <button class="pick ten" data-way="ten" disabled={ten !== null} onclick={() => onpull('ten')}>
      <small>10 連</small>
      <span class="price"
        ><span class="stack"
          >{#each COIN_STACK as i (i)}<PixelIcon art={ITEM_ART.coin} size="min(6cqw, 3.5cqh, 30px)" />{/each}</span
        >{TEN_COINS.toLocaleString('ja-JP')}</span
      >
      <small class="sure">レア以上 1 つ確定</small>
      {#if ten}<small class="why">{ten}</small>{/if}
    </button>
  </div>
  {#if bagCount(r) >= BAG_MAX}<p class="warn">持ち物がいっぱい。売るか合成してから引こう</p>{/if}
</section>

<style>
  .gacha {
    display: grid;
    gap: 10px;
    padding: 10px;
    border: 3px solid #ffd84a;
    background: #272040;
    font-size: min(3.2cqw, 1.9cqh, 16px);
  }

  .pity {
    display: flex;
    gap: 8px;
    align-items: center;
    color: #fff8ec;
  }

  .pity b {
    color: #ffd84a;
    white-space: nowrap;
  }

  .bar {
    flex: 1;
    height: 12px;
    border: 2px solid #5d6274;
    background: #1a1430;
  }

  .bar span {
    display: block;
    height: 100%;
    background: #ffd84a;
  }

  .tickets,
  .coins {
    display: grid;
    gap: 8px;
  }

  .tickets {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .coins {
    grid-template-columns: 2fr 3fr;
  }

  .pick {
    display: grid;
    gap: 4px;
    align-content: start;
    justify-items: center;
    padding: 8px 4px;
    border: 3px solid #24151f;
    box-shadow:
      inset 0 0 0 2px var(--rim),
      0 4px 0 #120c20;
    color: #fff8ec;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .pick:active {
    translate: 0 3px;
    box-shadow: inset 0 0 0 2px var(--rim);
  }

  .pick:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .pick b {
    font-size: 1.4em;
  }

  .t0 {
    --rim: #c9814a;
    background: #6b3a22;
  }

  .t1 {
    --rim: #bcc4ce;
    background: #3e4a5c;
  }

  .t2 {
    --rim: #ffd84a;
    background: #5a4210;
  }

  .one {
    --rim: #fff;
    align-content: center;
    background: #fff3d6;
    color: #24151f;
  }

  .ten {
    --rim: #fff8c0;
    background: #ffd84a;
    color: #24151f;
  }

  .price {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 1.4em;
  }

  .stack {
    display: flex;
  }

  .stack > :global(*) + :global(*) {
    margin-left: calc(min(6cqw, 3.5cqh, 30px) * -0.45);
  }

  .odds {
    color: #ffe28a;
  }

  .sure {
    color: #8e2430;
  }

  .why {
    color: #f093a3;
  }

  .one .why,
  .ten .why {
    color: #b03040;
  }

  .warn {
    margin: 0;
    color: #f093a3;
    text-align: center;
  }
</style>
