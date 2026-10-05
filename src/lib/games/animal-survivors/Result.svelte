<script lang="ts">
  import type { AchievementDef } from './achievements';
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { heatLabel } from './cauldron';
  import { ITEM_ART } from './art/items';
  import DamageTable from './DamageTable.svelte';
  import RunKit from './RunKit.svelte';
  import { clock } from './hud';
  import PixelIcon from './PixelIcon.svelte';
  import Trophy from './Trophy.svelte';
  import type { RunSummary } from './world';

  let {
    run,
    got,
    total,
    locked,
    onagain,
    onselect,
    again = true
  }: {
    run: RunSummary;
    got: AchievementDef[];
    total: number;
    locked: boolean;
    onagain: () => void;
    onselect: () => void;
    /** ふたりで遊ぶ子の端末では、もう一度は親が押す */
    again?: boolean;
  } = $props();

  const art = $derived(ANIMAL_ART[run.animal].forms[run.form]);
  const rows = $derived([
    ['生存時間', clock(run.time)],
    ['レベル', `Lv.${run.level}`],
    ['撃破数', run.kills.toLocaleString('ja-JP')],
    ['獲得経験値', Math.round(run.xp).toLocaleString('ja-JP')],
    ...(run.overtime ? [['延長戦', clock(run.overtime.secs)]] : [])
  ]);
  const title = $derived(run.overtime ? '延長戦 終了' : run.cleared ? '生存成功！' : 'GAME OVER');
</script>

<div class="as-screen room">
  <section class="as-panel" class:as-locked={locked} aria-label="結果">
    <h2 class="as-title" class:over={!run.cleared && !run.overtime}>{title}</h2>
    <Trophy list={got} />
    <p class="coins">
      <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" /><b>+{run.coins}</b> コイン（もちもの {total.toLocaleString(
        'ja-JP'
      )}）
      {#if run.bookCoins}<span class="book">図鑑 +{run.bookCoins}</span>{/if}
      {#if run.daily?.paid}<span class="book">お題クリア +{run.daily.bonus}</span>{/if}
    </p>
    {#if run.heat.level !== 2}
      <!-- 延長戦の回は 10:00 のクリアで賭けが戻っている -->
      <p class="ot">
        釜 {heatLabel(run.heat.level)}{#if run.heat.bet > 0}{run.cleared || run.overtime
            ? ` クリア 賭けた ${run.heat.bet} が戻った`
            : ` 賭けた ${run.heat.bet} は戻らない`}{/if}
      </p>
    {/if}
    {#if run.overtime}
      <p class="ot">
        延長戦 +{run.overtime.coins}{run.overtime.halved ? '（倒れたので半分）' : ''}<br />このステージの最高 {clock(
          run.overtime.best ?? run.overtime.secs
        )}
      </p>
    {/if}
    <div class="who">
      <PixelIcon art={run.cleared ? art.walk : art.hurt} size="min(18cqw, 10cqh, 96px)" />
      <span>使用キャラクター<br /><b>{animal(run.animal).forms[run.form]}</b></span>
    </div>
    <dl>
      {#each rows as [label, value] (label)}
        <dt>{label}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
    <RunKit {run} />
    <DamageTable {run} />
  </section>
</div>
<!-- 実績や武器の表が長くても押せるよう、スクロールする .as-screen の外の下に留める -->
<div class="bar" class:as-locked={locked} data-bar>
  <div class="buttons">
    <button class="as-card as-go" disabled={!again} onclick={onagain}
      >{again ? 'もう一度' : 'おやを まっています'}</button
    >
    <button class="as-card" onclick={onselect}>キャラ選択へ</button>
  </div>
</div>

<style>
  .coins {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: min(4.2cqw, 2.5cqh, 22px);
  }

  .book {
    color: #ffd84a;
  }

  .ot {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .coins b {
    color: #ffd84a;
  }

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

  .room {
    padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + min(10cqh, 84px) + 12px);
  }

  .bar {
    position: absolute;
    inset: auto 0 0;
    z-index: 6;
    padding: 12px 16px max(16px, env(safe-area-inset-bottom));
    background: #1f1530;
    box-shadow: 0 -3px 0 #160c1f;
  }

  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: min(100%, 560px);
    margin: 0 auto;
  }

  .buttons .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .buttons .as-card:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
