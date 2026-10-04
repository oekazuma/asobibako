<script lang="ts">
  import { ITEM_ART } from './art/items';
  import Bag from './Bag.svelte';
  import { BAG_MAX, bagCount, equip, equipBest, merge, sell } from './gacha';
  import { parseKey, SLOT_NAME, SLOTS, type GearKey } from './gear';
  import GearDetail from './GearDetail.svelte';
  import GearIcon from './GearIcon.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { loadRecords, saveRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  let r = $state(loadRecords());
  let picked = $state<GearKey | null>(null);
  const save = () => saveRecords($state.snapshot(r));

  function act(what: 'equip' | 'merge' | 'sell' | 'close') {
    const k = picked;
    if (!k || what === 'close') return void (picked = null);
    if (what === 'equip') equip(r, k);
    else if (what === 'merge') picked = merge(r, k);
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
      <button
        class="as-card best"
        onclick={() => {
          equipBest(r);
          save();
        }}>最強をつける</button
      >
    {/if}
    {#if picked && r.bag[picked]}
      <GearDetail gear={picked} count={r.bag[picked] ?? 0} worn={Object.values(r.worn).includes(picked)} onact={act} />
    {/if}
    <Bag bag={r.bag} worn={r.worn} onpick={(k) => (picked = k)} />
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

  .best {
    justify-content: center;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .back {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
