<script lang="ts">
  import { itemArt } from './art/evolved';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { MAX_LEVEL, WEAPONS } from './weapons';
  import type { RunSummary } from './world';

  let { run }: { run: RunSummary } = $props();

  const top = $derived(Math.max(1, ...run.dealt.map((d) => d.damage)));
  // 持ち物に無い武器は Lv5 で進化した元の武器
  const level = (id: string) => run.weapons.find((o) => o.id === id)?.level ?? MAX_LEVEL;
  const n = (v: number) => v.toLocaleString('ja-JP');
</script>

<div class="dmg" role="table" aria-label="武器ごとのダメージ">
  <div class="row head" role="row">
    <span role="columnheader">武器</span><span role="columnheader">ダメージ</span><span role="columnheader">撃破</span>
  </div>
  {#each run.dealt as d (d.id)}
    <div class="row" role="row" style:--r={d.damage / top}>
      <span class="name" role="cell">
        <PixelIcon art={itemArt(`weapon-${d.id}`)} size="min(6cqw, 3.6cqh, 32px)" />
        {WEAPONS[d.id].name}<small
          >{#if WEAPONS[d.id].special}<span class="crown"
              ><PixelIcon art={ITEM_ART.crown} size="min(3.4cqw, 2cqh, 16px)" /></span
            >{:else}{WEAPONS[d.id].evolved ? '★' : `Lv${level(d.id)}`}{/if}</small
        >
      </span>
      <span role="cell">{n(d.damage)}</span>
      <span role="cell">{n(d.kills)}</span>
    </div>
  {/each}
</div>
<ul class="passives" aria-label="取ったパッシブ">
  {#each run.passives as o (o.id)}
    <li><PixelIcon art={itemArt(`passive-${o.id}`)} size="min(7cqw, 4cqh, 36px)" /><span>{o.level}</span></li>
  {/each}
</ul>

<style>
  .dmg {
    display: grid;
    gap: 2px;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 5em 3.5em;
    gap: 6px;
    align-items: center;
    padding: 3px 6px;
    text-align: right;
    color: #ffd84a;
    background: linear-gradient(90deg, rgb(216 70 60 / 0.35) calc(var(--r, 0) * 100%), transparent 0);
  }

  .head {
    color: #c9b8e8;
    font-weight: 700;
    background: none;
  }

  .head span:first-child {
    text-align: left;
  }

  .name {
    display: flex;
    gap: 6px;
    align-items: center;
    color: #fff3d6;
  }

  small {
    color: #ffd84a;
  }

  .passives {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .passives li {
    position: relative;
    padding: 3px;
    background: #1f1530;
  }

  .passives span {
    position: absolute;
    right: 2px;
    bottom: 0;
    color: #ffd84a;
    font-size: min(3cqw, 1.8cqh, 14px);
  }
</style>
