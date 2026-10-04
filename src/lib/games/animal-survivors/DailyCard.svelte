<script lang="ts">
  import { animal } from './animals';
  import { ANIMAL_ART } from './art/animals';
  import { heatLabel } from './cauldron';
  import { dailyBonus, type Daily } from './daily';
  import PixelIcon from './PixelIcon.svelte';
  import { stageOf } from './stages';

  /** しばりと今日の札は開いた先の画面で見せ、ここは 1 行にとどめて出発のボタンより目立たせない */
  let { daily, onopen }: { daily: Daily; onopen: () => void } = $props();
</script>

<button class="as-card daily" class:done={daily.cleared} data-daily onclick={onopen}>
  <PixelIcon art={ANIMAL_ART[daily.animal].forms[0].walk} size="min(7cqw, 4cqh, 36px)" />
  <span class="body">
    <b>今日のお題</b>
    <small>{animal(daily.animal).name}・{stageOf(daily.stage).name}・釜 {heatLabel(daily.heat ?? 2)}</small>
  </span>
  <span class="prize">{daily.cleared ? 'クリア済み' : `+${dailyBonus(daily)}`}</span>
  <span class="arrow">›</span>
</button>

<style>
  .daily {
    gap: 10px;
    padding-block: min(0.8cqh, 6px);
    background: #efe2c6;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  .done {
    background: #e8dcc0;
  }

  .body {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 0 10px;
    align-items: baseline;
  }

  small {
    color: #5d3a2a;
    font-size: 0.85em;
  }

  .prize {
    color: #a3501c;
    white-space: nowrap;
  }

  .arrow {
    color: #8a6a4a;
    font-size: 1.4em;
  }
</style>
