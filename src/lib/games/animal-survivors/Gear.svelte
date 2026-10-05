<script lang="ts">
  import Back from './Back.svelte';
  import { ITEM_ART } from './art/items';
  import Bag from './Bag.svelte';
  import { BAG_MAX, bagCount, equip, equipBest, merge, sell, tidy, tidyPreview, toggleLock } from './gacha';
  import { parseKey, SLOT_NAME, SLOTS, type GearKey } from './gear';
  import GearDetail from './GearDetail.svelte';
  import GearIcon from './GearIcon.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { loadRecords, saveRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  let r = $state(loadRecords());
  let picked = $state<GearKey | null>(null);
  const save = () => saveRecords($state.snapshot(r));
  /** まとめて売るは 1 回めに数を見せ、もう一度押すと売る */
  let sure = $state(false);
  const plan = $derived(tidyPreview(r));

  function act(what: 'equip' | 'merge' | 'sell' | 'lock' | 'close') {
    sure = false;
    const k = picked;
    if (!k || what === 'close') return void (picked = null);
    if (what === 'equip') equip(r, k);
    else if (what === 'merge') picked = merge(r, k);
    else if (what === 'lock') toggleLock(r, k);
    else sell(r, k);
    if (picked && !r.bag[picked]) picked = null;
    save();
  }
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="装備">
    <h2 class="as-title">装備</h2>
    <p class="purse">
      <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" />
      {r.coins.toLocaleString('ja-JP')}<span class="count">持ち物 {bagCount(r)} / {BAG_MAX}</span>
    </p>
    <div class="slots">
      {#each SLOTS as s (s)}
        {@const k = r.worn[s]}
        <div class="slot">
          <small>{SLOT_NAME[s]}</small>
          {#if k}
            <GearIcon gear={k} size="min(9cqw, 5cqh, 44px)" />
            <span>{parseKey(k)?.def.name}</span>
          {:else}
            <span class="none">なし</span>
          {/if}
        </div>
      {/each}
    </div>
    {#if bagCount(r)}
      <div class="tools">
        <button
          class="as-card"
          onclick={() => {
            equipBest(r);
            sure = false;
            save();
          }}>最強装備をつける</button
        >
        <button
          class="as-card"
          disabled={!plan.merged && !plan.sold}
          onclick={() => {
            if (!sure) return void (sure = true);
            tidy(r);
            sure = false;
            picked = null;
            save();
          }}
          >{#if sure}本当に売る<small
              >{plan.merged ? `合成 ${plan.merged} 回・` : ''}{plan.sold} 個を売って +{plan.coins}</small
            >{:else}まとめて売る<small>合成して、弱い品を売る</small>{/if}</button
        >
      </div>
    {/if}
    {#if picked && r.bag[picked]}
      <GearDetail
        gear={picked}
        count={r.bag[picked] ?? 0}
        worn={Object.values(r.worn).includes(picked)}
        locked={r.locks.includes(picked)}
        onact={act}
      />
    {/if}
    <Bag bag={r.bag} worn={r.worn} locks={r.locks} onpick={(k) => ((picked = k), (sure = false))} />
  </section>
</div>
<Back {onback} />

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

  .slots {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .slot {
    display: grid;
    gap: 4px;
    justify-items: center;
    padding: 6px 4px;
    border: 3px solid #5d6274;
    color: #fff8ec;
    font-size: min(3cqw, 1.8cqh, 15px);
    text-align: center;
  }

  .slot small {
    color: #ffd84a;
  }

  .none {
    color: #9aa0ae;
  }

  .tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .tools .as-card {
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    font-size: min(3.8cqw, 2.3cqh, 19px);
  }

  .tools small {
    color: #8a6a4a;
    font-size: 0.65em;
  }

  .tools .as-card:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
