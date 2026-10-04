<script lang="ts">
  import { oddsTable, percent, PITY, ticketOdds, type Ticket } from './gacha';
  import { GEAR, keyOf, RARITY_NAME, SLOT_NAME, SLOTS } from './gear';
  import GearIcon from './GearIcon.svelte';

  /** どの券を見ているか（コインで引くのと 10 連は銅の券と同じ割合） */
  let t = $state<Ticket>(0);
  const TABS: [Ticket, string][] = [
    [0, '銅の券・コイン'],
    [1, '銀の券'],
    [2, '金の券']
  ];
  const RARITIES = [0, 1, 2] as const;
  const o = $derived(oddsTable(t));
  const high = ticketOdds(9);
</script>

<section class="odds" aria-label="ガチャのかくりつ">
  <div class="tabs">
    {#each TABS as [k, label] (k)}
      <button class:on={t === k} aria-pressed={t === k} data-tab={k} onclick={() => (t = k)}>{label}</button>
    {/each}
  </div>
  <table>
    <thead>
      <tr
        ><th>レア度</th>{#each RARITIES as r (r)}<th class="r{r}">{RARITY_NAME[r]}</th>{/each}</tr
      >
    </thead>
    <tbody>
      <tr
        ><th>合わせて</th>{#each RARITIES as r (r)}<td>{percent(o.rarity[r])}</td>{/each}</tr
      >
    </tbody>
  </table>
  {#each SLOTS as s (s)}
    <table>
      <thead>
        <tr
          ><th class="slot">{SLOT_NAME[s]}</th>{#each RARITIES as r (r)}<th class="r{r}">{RARITY_NAME[r]}</th
            >{/each}</tr
        >
      </thead>
      <tbody>
        {#each GEAR.filter((d) => d.slot === s) as d (d.id)}
          <tr data-odds-item>
            <th
              ><span class="item"><GearIcon gear={keyOf(d.id, 0)} size="min(4.4cqw, 2.6cqh, 22px)" />{d.name}</span></th
            >
            {#each RARITIES as r (r)}<td>{percent(o.perItem[r])}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/each}
  <ul class="notes">
    <li>コインで 10 連は、1 つ以上がレア以上になります</li>
    <li>伝説が出ないまま {PITY} 回めは、伝説になります</li>
    <li>品はレア度を決めてから、{GEAR.length} 種から同じ割合で選びます</li>
    <li>
      ボス・ヌシ・ステージの主が落とす券は、釜 2.0 以下で銅の券だけ、釜 9.0 で銅 {percent(high[0])}・銀 {percent(
        high[1]
      )}・金 {percent(high[2])}（あいだの強さはその間）
    </li>
  </ul>
</section>

<style>
  .odds {
    display: grid;
    gap: 10px;
    padding: 10px;
    border: 3px solid #5d6274;
    background: #272040;
    color: #fff8ec;
    font-size: min(3cqw, 1.8cqh, 15px);
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .tabs button {
    padding: 6px 2px;
    border: 3px solid #5d6274;
    background: #3a3256;
    color: #fff8ec;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .tabs .on {
    border-color: #ffd84a;
    background: #ffd84a;
    color: #24151f;
  }

  /* 表どうしで列の位置をそろえる */
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th:first-child {
    width: 46%;
  }

  th,
  td {
    padding: 3px 4px;
    border-bottom: 1px solid #3a3256;
    text-align: right;
    white-space: nowrap;
  }

  th:first-child {
    text-align: left;
    white-space: normal;
  }

  .item {
    display: flex;
    gap: 6px;
    align-items: center;
    white-space: normal;
  }

  .slot {
    color: #ffd84a;
    text-align: left;
  }

  .r1 {
    color: #5ab0ff;
  }

  .r2 {
    color: #ffd84a;
  }

  .notes {
    display: grid;
    gap: 4px;
    margin: 0;
    padding-left: 1.2em;
    color: #d8d0e8;
  }
</style>
