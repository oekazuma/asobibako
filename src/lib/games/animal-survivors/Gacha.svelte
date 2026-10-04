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

  /** 引き方・券・ふちの色・地の色 */
  const TICKETS: [PullWay, 0 | 1 | 2, string, string][] = [
    ['bronze', 0, '#c9814a', '#6b3a22'],
    ['silver', 1, '#bcc4ce', '#3e4a5c'],
    ['gold', 2, '#ffd84a', '#5a4210']
  ];
  /** 読み上げには絵が届かないので、何で引くかと押せない理由を名前に入れる */
  const name = (what: string, why: string | null) => (why ? `${what}（${why}）` : what);
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
    {#each TICKETS as [way, t, rim, bg] (way)}
      {@const why = whyNot(r, way)}
      <button
        class="as-pick"
        style:--rim={rim}
        style:background={bg}
        data-way={way}
        aria-label={name(`${TICKET_NAME[t]}で引く（${r.tickets[t]} 枚）`, why)}
        disabled={why !== null}
        onclick={() => onpull(way)}
      >
        <small>{TICKET_NAME[t]}</small>
        <PixelIcon art={GEAR_ART[`ticket${t}`]} size="min(13cqw, 7.5cqh, 64px)" />
        <b>×{r.tickets[t]}</b>
        <small class="odds">伝説 {percent(ODDS[t][2])}</small>
        {#if why}<small class="why">{why}</small>{/if}
      </button>
    {/each}
  </div>
  <div class="coins">
    <button
      class="as-pick one"
      data-way="coin"
      aria-label={name(`コインで引く（${PULL_COINS}）`, one)}
      disabled={one !== null}
      onclick={() => onpull('coin')}
    >
      <small>1 回</small>
      <span class="price"><PixelIcon art={ITEM_ART.coin} size="var(--coin)" />{PULL_COINS}</span>
      {#if one}<small class="why">{one}</small>{/if}
    </button>
    <button
      class="as-pick ten"
      data-way="ten"
      aria-label={name(`コインで 10 連（${TEN_COINS}、レア以上 1 つ確定）`, ten)}
      disabled={ten !== null}
      onclick={() => onpull('ten')}
    >
      <small>10 連</small>
      <span class="price"
        ><span class="stack"
          >{#each COIN_STACK as i (i)}<PixelIcon art={ITEM_ART.coin} size="var(--coin)" />{/each}</span
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
    --coin: min(6cqw, 3.5cqh, 30px);
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

  .as-pick b {
    font-size: 1.4em;
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

  .stack > :global(canvas + canvas) {
    margin-left: calc(var(--coin) * -0.45);
  }

  .odds {
    color: #ffe28a;
  }

  .sure {
    color: #8e2430;
  }

  .one .why,
  .ten .why {
    color: #6e0c1c;
  }

  .warn {
    margin: 0;
    color: #f093a3;
    text-align: center;
  }
</style>
