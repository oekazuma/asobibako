<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { ITEM_ART } from './art/items';
  import { clock } from './hud';
  import PixelIcon from './PixelIcon.svelte';
  import type { RunSummary } from './world';

  let {
    run,
    locked,
    onagain,
    onselect
  }: { run: RunSummary; locked: boolean; onagain: () => void; onselect: () => void } = $props();

  const art = $derived(ANIMAL_ART[run.animal]);
  const rows = $derived([
    ['生存時間', clock(run.time)],
    ['レベル', `Lv.${run.level}`],
    ['撃破数', run.kills.toLocaleString('ja-JP')],
    ['獲得経験値', Math.round(run.xp).toLocaleString('ja-JP')]
  ]);
  const owned = $derived([
    ...run.weapons.map((o) => ({ ...o, key: `weapon-${o.id}` })),
    ...run.passives.map((o) => ({ ...o, key: `passive-${o.id}` }))
  ]);
</script>

<div class="as-screen">
  <section class="as-panel" class:as-locked={locked} aria-label="結果">
    <h2 class="as-title" class:over={!run.cleared}>{run.cleared ? '生存成功！' : 'GAME OVER'}</h2>
    <div class="who">
      <PixelIcon art={run.cleared ? art.walk : art.hurt} size="min(18cqw, 10cqh, 96px)" />
      <span>使用キャラクター<br /><b>{animal(run.animal).name}</b></span>
    </div>
    <dl>
      {#each rows as [label, value] (label)}
        <dt>{label}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
    <ul class="owned" aria-label="取った武器とパッシブ">
      {#each owned as o (o.key)}
        <li class="slot">
          <PixelIcon art={ITEM_ART[o.key]} size="min(8cqw, 4.6cqh, 40px)" /><span class="lv">{o.level}</span>
        </li>
      {/each}
    </ul>
    <div class="buttons">
      <button class="as-card" onclick={onagain}>もう一度</button>
      <button class="as-card" onclick={onselect}>キャラ選択へ</button>
    </div>
  </section>
</div>

<style>
  .over {
    color: #ff7b6e;
  }

  .who {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    font-size: min(3.6cqw, 2.2cqh, 18px);
  }

  .who b {
    font-size: 1.6em;
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 6px 24px;
    justify-content: center;
    margin: 0;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  dt {
    color: #c9b8e8;
  }

  dd {
    margin: 0;
    text-align: right;
    color: #ffd84a;
  }

  .owned {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .slot {
    position: relative;
    padding: 3px;
    background: #1f1530;
  }

  .lv {
    position: absolute;
    right: 2px;
    bottom: 0;
    color: #ffd84a;
    font-size: min(3cqw, 1.8cqh, 14px);
    text-shadow: 1px 1px 0 #24151f;
  }

  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .buttons .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
