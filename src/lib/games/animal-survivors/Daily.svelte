<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import ArcanaRow from './ArcanaRow.svelte';
  import { heatLabel } from './cauldron';
  import { dailyBonus, MODS, type Daily } from './daily';
  import PixelIcon from './PixelIcon.svelte';
  import { stageOf } from './stages';

  let { daily, onstart, onback }: { daily: Daily; onstart: () => void; onback: () => void } = $props();
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="今日のお題">
    <h2 class="as-title">今日のお題</h2>
    <p class="date">{daily.date.replaceAll('-', '/')}</p>
    <div class="who">
      <PixelIcon art={ANIMAL_ART[daily.animal].forms[0].walk} size="min(18cqw, 10cqh, 96px)" />
      <span><b>{animal(daily.animal).name}</b><br />{stageOf(daily.stage).name}・釜 {heatLabel(daily.heat ?? 2)}</span>
    </div>
    <ul class="mods">
      {#each daily.mods as id (id)}
        <li class:good={MODS[id].good}><b>{MODS[id].name}</b><span>{MODS[id].text}</span></li>
      {/each}
    </ul>
    {#if daily.card}<ArcanaRow cards={[daily.card]} detail />{/if}
    <p class="prize">
      {daily.cleared ? '今日のごほうびは受け取りました' : `ごほうび ${dailyBonus(daily)} コイン`}
    </p>
    <p class="note">何度でも挑戦できます。ごほうびはその日に初めてクリアしたときだけです</p>
    <button class="as-card go" onclick={onstart}>挑戦する</button>
    <button class="as-card" onclick={onback}>もどる</button>
  </section>
</div>

<style>
  .date,
  .note {
    margin: 0;
    text-align: center;
    color: #d8d0e8;
    font-size: min(3.4cqw, 2cqh, 17px);
  }

  .who {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    color: #fff3d6;
    font-size: min(4.4cqw, 2.6cqh, 22px);
    font-weight: 800;
  }

  .mods {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .mods li {
    display: flex;
    gap: 12px;
    align-items: baseline;
    padding: 8px 12px;
    background: #3a1d4a;
    color: #fff3d6;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  .mods b {
    color: #ff9a8a;
  }

  .mods .good b {
    color: #8fd14f;
  }

  .prize {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(4.6cqw, 2.7cqh, 24px);
    font-weight: 900;
  }

  .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .go {
    background: #ffd84a;
  }
</style>
