<script lang="ts">
  import { GEAR_ART } from './art/gear';
  import Capsule from './Capsule.svelte';
  import { BAG_MAX, bagCount, canPull, PITY, PULL_COINS, TEN_COINS, TICKET_NAME, type PullWay } from './gacha';
  import type { GearKey } from './gear';
  import PixelIcon from './PixelIcon.svelte';
  import type { Records } from './records';

  /** 記録を書き換えて保存するのは装備の画面。ここは引いた品を見せるだけ */
  let { r, onpull }: { r: Records; onpull: (way: PullWay) => GearKey[] | null } = $props();

  /** 同じ品が 2 つ出ることがあるので、引いた順の番号を付けて並べる */
  let got = $state<{ gear: GearKey; id: number }[]>([]);
  let round = $state(0);
  const TICKETS = [0, 1, 2] as const;
  const WAYS: [PullWay, string][] = [
    ['bronze', '銅の券で引く'],
    ['silver', '銀の券で引く'],
    ['gold', '金の券で引く'],
    ['coin', `コインで引く（${PULL_COINS}）`],
    ['ten', `コインで 10 連（${TEN_COINS}）`]
  ];

  function go(way: PullWay) {
    const k = onpull(way);
    if (!k) return;
    round += 1;
    got = k.map((gear, i) => ({ gear, id: round * 10 + i }));
  }
</script>

<section class="gacha" aria-label="ガチャ">
  <p class="tickets">
    {#each TICKETS as t (t)}
      <span
        ><PixelIcon art={GEAR_ART[`ticket${t}`]} size="min(6cqw, 3.5cqh, 30px)" />{TICKET_NAME[t]} ×{r.tickets[t]}</span
      >
    {/each}
  </p>
  <p class="pity">伝説まであと {PITY - r.pity} 回</p>
  <div class="ways">
    {#each WAYS as [way, label] (way)}
      <button class="as-card" class:wide={way === 'ten'} disabled={!canPull(r, way)} onclick={() => go(way)}
        >{label}</button
      >
    {/each}
  </div>
  {#if bagCount(r) >= BAG_MAX}<p class="warn">持ち物がいっぱい。売るか合成してから引こう</p>{/if}
  {#key round}
    {#if got.length}
      <div class="got" class:ten={got.length > 1}>
        {#each got as c, i (c.id)}<Capsule gear={c.gear} delay={i * 0.25} />{/each}
      </div>
    {/if}
  {/key}
</section>

<style>
  .gacha {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 3px solid #ffd84a;
    background: #272040;
  }

  .tickets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    justify-content: center;
    margin: 0;
    color: #fff8ec;
    font-size: min(3cqw, 1.8cqh, 15px);
  }

  .tickets span {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .pity {
    margin: 0;
    color: #ffd84a;
    font-size: min(3.2cqw, 1.9cqh, 16px);
    text-align: center;
  }

  .ways {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .ways button {
    justify-content: center;
    font-size: min(3cqw, 1.8cqh, 15px);
  }

  .ways button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .wide {
    grid-column: span 2;
  }

  .warn {
    margin: 0;
    color: #f093a3;
    text-align: center;
  }

  .got {
    display: grid;
    grid-template-columns: 1fr;
  }

  .ten {
    grid-template-columns: repeat(5, 1fr);
  }
</style>
