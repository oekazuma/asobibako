<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { arcanaDef } from './arcana';
  import { heatLabel } from './cauldron';
  import { dailyBonus, MODS, type Daily } from './daily';
  import PixelIcon from './PixelIcon.svelte';
  import { stageOf } from './stages';

  let { daily, onopen }: { daily: Daily; onopen: () => void } = $props();
</script>

<button class="as-card daily" class:done={daily.cleared} onclick={onopen}>
  <PixelIcon art={ANIMAL_ART[daily.animal].forms[0].walk} size="min(11cqw, 6.4cqh, 64px)" />
  <span class="body">
    <span class="head"
      >今日のお題<span class="prize">{daily.cleared ? 'クリア済み' : `+${dailyBonus(daily)}`}</span></span
    >
    <span class="what">{animal(daily.animal).name}・{stageOf(daily.stage).name}・釜 {heatLabel(daily.heat ?? 2)}</span>
    <span class="mods">{daily.mods.map((id) => MODS[id].name).join('・')}</span>
    {#if daily.card}<span class="card">今日の札 {arcanaDef(daily.card).name}</span>{/if}
  </span>
</button>

<style>
  .daily {
    background: #ffe9a8;
  }

  .done {
    background: #e8dcc0;
  }

  .body {
    display: grid;
    flex: 1;
    gap: 2px;
  }

  .head {
    display: flex;
    align-items: baseline;
    font-size: min(4.4cqw, 2.5cqh, 22px);
  }

  .prize {
    margin-left: auto;
    color: #a3501c;
    font-size: 0.8em;
  }

  .what,
  .mods {
    color: #5d3a2a;
    font-size: min(3.2cqw, 1.9cqh, 16px);
    font-weight: 700;
  }

  .mods {
    color: #8e2430;
  }

  .card {
    color: #6a3fb0;
    font-size: min(3.2cqw, 1.9cqh, 16px);
    font-weight: 700;
  }
</style>
